'use server';

import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Student, IStudent } from '@/models/Student';
import { Scan } from '@/models/Scan';
import { Organization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';
import { CreateStudentSchema, StudentIdSchema, validateOrThrow } from '@/lib/schemas';
import { safeEquals } from '@/lib/sanitize';
import { handleError } from '@/lib/error-handler';
import { logStudentRegistration, logUnhandledError, logDataIntegrityFailure } from '@/lib/security-logger';
import { verifyChecksum, generateChecksum } from '@/lib/integrity';
import { obfuscateEmail, obfuscateStudentId } from '@/lib/crypto';

// Helper to serialize MongoDB documents for client components
// Converts _id to string and Date objects to ISO strings
function serializeStudent(student: any): IStudent {
  return {
    ...student,
    _id: student._id.toString(),
    registeredAt: student.registeredAt?.toISOString?.() ?? student.registeredAt,
    lastScanTime: student.lastScanTime?.toISOString?.() ?? student.lastScanTime,
    createdAt: student.createdAt?.toISOString?.() ?? student.createdAt,
    updatedAt: student.updatedAt?.toISOString?.() ?? student.updatedAt,
  } as IStudent;
}

/**
 * Create a new student with optional integrity verification
 * @param studentId - Student identifier
 * @param email - Student email
 * @param fullName - Student full name
 * @param organizationId - First organization visited
 * @param organizationName - Organization name
 * @param boothNumber - Booth number
 * @param checksum - Optional SHA-256 checksum for integrity verification
 */
export async function createStudent(
  studentId: string,
  email: string,
  fullName: string,
  organizationId: string,
  organizationName: string,
  boothNumber: string,
  checksum?: string
): Promise<void> {
  await dbConnect();

  // Validate all inputs
  const validated = validateOrThrow(CreateStudentSchema, {
    studentId,
    email,
    fullName,
    organizationId,
    organizationName,
    boothNumber,
  });

  // Verify data integrity if checksum provided
  if (checksum) {
    const dataToVerify = {
      studentId: validated.studentId,
      email: validated.email,
      fullName: validated.fullName,
      organizationId: validated.organizationId,
    };
    
    const isValid = verifyChecksum(dataToVerify, checksum);
    if (!isValid) {
      await logDataIntegrityFailure(
        'student_registration',
        `Checksum mismatch for ${obfuscateStudentId(validated.studentId)} (${obfuscateEmail(validated.email)})`,
        validated.studentId
      );
      throw new Error('Data integrity verification failed. Please try again.');
    }
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Create student with validated data
      await Student.create([{
        studentId: validated.studentId,
        email: validated.email,
        fullName: validated.fullName,
        visitedStalls: [validated.organizationId],
        scanCount: 1,
        registeredAt: new Date(),
        lastScanTime: new Date(),
        feedbackSubmitted: false,
      }], { session });

      // Create initial scan record
      const scanId = `${validated.studentId}_1`;
      await Scan.create([{
        scanId,
        studentId: validated.studentId,
        studentEmail: validated.email,
        organizationId: validated.organizationId,
        organizationName: validated.organizationName,
        boothNumber: validated.boothNumber,
        timestamp: new Date(),
        scanMethod: 'qr_code',
      }], { session });

      // Update organization visitor count
      await Organization.updateOne(
        { organizationId: safeEquals(validated.organizationId) },
        { 
          $inc: { visitorCount: 1 },
          $push: { visitors: validated.studentId }
        }
      ).session(session);
    });

    // Log successful registration
    await logStudentRegistration(validated.studentId, true);

    revalidatePath('/student');
  } catch (error) {
    // Log failed registration
    await logStudentRegistration(studentId, false, error instanceof Error ? error.message : 'Unknown error');
    
    const handled = handleError(error);
    throw new Error(handled.message);
  } finally {
    await session.endSession();
  }
}

export async function getStudent(studentId: string): Promise<IStudent | null> {
  await dbConnect();

  try {
    // Validate input
    const validatedStudentId = validateOrThrow(StudentIdSchema, studentId);
    
    const student = await Student.findOne({ studentId: safeEquals(validatedStudentId) }).lean();
    if (!student) return null;
    
    return serializeStudent(student);
  } catch (error) {
    console.error('Error getting student:', error);
    return null;
  }
}

export async function getAllStudents(): Promise<IStudent[]> {
  await dbConnect();
  
  try {
    const students = await Student.find({}).lean();
    return students.map(serializeStudent);
  } catch (error) {
    console.error('Error getting all students:', error);
    return [];
  }
}
