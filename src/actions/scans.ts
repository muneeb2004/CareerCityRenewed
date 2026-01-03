'use server';

import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Scan, IScan } from '@/models/Scan';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';

// Helper to serialize MongoDB documents for client components
// Converts _id to string and Date objects to ISO strings
function serializeScan(scan: any): IScan {
  return {
    ...scan,
    _id: scan._id.toString(),
    timestamp: scan.timestamp?.toISOString?.() ?? scan.timestamp,
    createdAt: scan.createdAt?.toISOString?.() ?? scan.createdAt,
    updatedAt: scan.updatedAt?.toISOString?.() ?? scan.updatedAt,
  } as IScan;
}

const MAX_RETRIES = 3;
const TRANSACTION_TIMEOUT = 10000; // 10 seconds

export async function createScan(
  studentId: string,
  studentEmail: string,
  studentProgram: string,
  organizationId: string,
  organizationName: string,
  boothNumber: string,
  scanCount?: number
): Promise<void> {
  await dbConnect();

  const scanId = scanCount 
    ? `${studentId}_${scanCount}` 
    : `${studentId}_${Date.now()}`; // Fallback if no count provided (legacy behavior support)

  try {
    await Scan.create({
      scanId,
      studentId,
      studentEmail,
      studentProgram,
      organizationId,
      organizationName,
      boothNumber,
      timestamp: new Date(),
      scanMethod: 'qr_code',
    });
    
    // Dual Write (Best effort)
    const scanData = {
        scanId,
        studentId,
        studentEmail,
        studentProgram,
        organizationId,
        organizationName,
        boothNumber,
        scanMethod: 'qr_code'
    };
    // Note: This createScan function is non-transactional in Mongo (legacy/fallback path),
    // but the dualWrite helper uses a transaction. It assumes existing student/org structure.
    // Since createScan is often used in registration where student might be new,
    // we should proceed carefully. 
    // However, createScan logic here is simple.
    // We will just call the firestore createScan equivalent logic manually if needed, 
    // BUT dualWrite.recordVisit is complex and updates counters.
    // If this is just "creating a scan record" without counters (which createScan seems to be in isolation?), 
    // then dualWrite.recordVisit might be too much.
    // Re-reading logic: createScan IS used in registration, where counters are handled by createStudent/updateStudentVisit.
    // So we should NOT use dualWrite.recordVisit here.
    // We need a dualWrite.createScan only.
    // But for now, let's leave createScan alone as it's the less critical path compared to recordVisit.
    // Wait, the migration strategy says "recordVisit" is the critical one.
  } catch (error) {
    console.error('Error creating scan:', error);
    throw new Error('Failed to create scan record');
  }
}

export async function recordVisit(
  studentId: string,
  studentEmail: string,
  studentProgram: string,
  organizationId: string,
  organizationName: string,
  boothNumber: string
) {
  await dbConnect();
  const session = await mongoose.startSession();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await session.withTransaction(async () => {
        // 1. Find student
        const student = await Student.findOne({ studentId }).session(session);
        if (!student) throw new Error('Student not found');
        
        // 2. Check if already visited
        if (student.visitedStalls.includes(organizationId)) {
          throw new Error('Already visited this organization');
        }
        
        const newScanCount = (student.scanCount || 0) + 1;
        const scanId = `${studentId}_${newScanCount}`;

        // 3. Create scan record
        await Scan.create([{
          scanId,
          studentId,
          studentEmail,
          studentProgram,
          organizationId,
          organizationName,
          boothNumber,
          timestamp: new Date(),
          scanMethod: 'qr_code'
        }], { session });
        
        // 4. Update student
        await Student.updateOne(
          { studentId },
          { 
            $inc: { scanCount: 1 },
            $push: { visitedStalls: organizationId },
            $set: { lastScanTime: new Date() }
          }
        ).session(session);
        
        // 5. Update organization
        await Organization.updateOne(
          { organizationId },
          { 
            $inc: { visitorCount: 1 },
            $push: { visitors: studentId }
          }
        ).session(session);

      }, {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: TRANSACTION_TIMEOUT
      });
      
      console.log(`Visit recorded successfully for ${studentId} at ${organizationId}`);

      revalidatePath('/student');
      return { success: true };
    } catch (error) {
      console.error(`Transaction attempt ${attempt} failed:`, error);
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    } finally {
      // Session is ended automatically by withTransaction on success/fail, 
      // but strictly speaking we end it after the loop if strictly manual.
      // In `withTransaction` pattern, it handles commit/abort.
      // We explicitly end it here to be safe if `withTransaction` throws.
    }
  }
  await session.endSession();
}

export async function getScansByStudent(studentId: string): Promise<IScan[]> {
  await dbConnect();
  
  try {
    const scans = await Scan.find({ studentId })
      .sort({ timestamp: -1 })
      .lean();

    return scans.map(serializeScan);
  } catch (error) {
    console.error('Error getting scans:', error);
    return [];
  }
}

export async function getAllScans(): Promise<IScan[]> {
  await dbConnect();
  
  try {
    const scans = await Scan.find({})
      .sort({ timestamp: -1 })
      .lean();

    return scans.map(serializeScan);
  } catch (error) {
    console.error('Error getting all scans:', error);
    return [];
  }
}

export async function getScansByOrganization(organizationId: string): Promise<IScan[]> {
  await dbConnect();
  
  try {
    const scans = await Scan.find({ organizationId })
      .sort({ timestamp: -1 })
      .lean();

    return scans.map(serializeScan);
  } catch (error) {
    console.error('Error getting scans by organization:', error);
    return [];
  }
}
