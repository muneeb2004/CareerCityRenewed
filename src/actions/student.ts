'use server';

import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Student, IStudent } from '@/models/Student';
import { Scan } from '@/models/Scan';
import { Organization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';

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

export async function createStudent(
  studentId: string,
  email: string,
  fullName: string,
  organizationId: string,
  organizationName: string,
  boothNumber: string
): Promise<void> {
  await dbConnect();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Create student
      await Student.create([{
        studentId,
        email,
        fullName,
        visitedStalls: [organizationId],
        scanCount: 1,
        registeredAt: new Date(),
        lastScanTime: new Date(),
        feedbackSubmitted: false,
      }], { session });

      // Create initial scan record
      const scanId = `${studentId}_1`;
      await Scan.create([{
        scanId,
        studentId,
        studentEmail: email,
        organizationId,
        organizationName,
        boothNumber,
        timestamp: new Date(),
        scanMethod: 'qr_code',
      }], { session });

      // Update organization visitor count
      await Organization.updateOne(
        { organizationId },
        { 
          $inc: { visitorCount: 1 },
          $push: { visitors: studentId }
        }
      ).session(session);
    });

    revalidatePath('/student');
  } catch (error) {
    console.error('Error creating student:', error);
    throw new Error('Failed to create student');
  } finally {
    await session.endSession();
  }
}

export async function getStudent(studentId: string): Promise<IStudent | null> {
  await dbConnect();

  try {
    const student = await Student.findOne({ studentId }).lean();
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
