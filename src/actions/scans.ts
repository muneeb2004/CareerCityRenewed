import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Scan, IScan } from '@/models/Scan';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';
import { isDuplicate } from '@/lib/deduplication';
import { checkRateLimit } from '@/lib/rate-limit';
import { dbBreaker } from '@/lib/circuit-breaker';

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

// ... (keep createScan)

export async function recordVisit(
  studentId: string,
  studentEmail: string,
  studentProgram: string,
  organizationId: string,
  organizationName: string,
  boothNumber: string
) {
  // 0. Rate Limit Check (10 scans per 10s per student)
  const rateLimit = checkRateLimit(studentId, 10, 10000);
  if (!rateLimit.allowed) {
    throw new Error('Too many requests. Please wait a moment.');
  }

  // 1. Deduplication check
  const dedupKey = `scan:${studentId}:${organizationId}`;
  if (isDuplicate(dedupKey)) {
    console.log(`[DEDUP] Duplicate scan prevented for ${studentId} at ${organizationId}`);
    return { success: true, deduplicated: true };
  }

      // 2. Circuit Breaker & Transaction

      try {

        return await dbBreaker.execute(async () => {

          await dbConnect();

          const session = await mongoose.startSession();

    

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

            try {

              await session.withTransaction(async () => {

                // ... (keep existing transaction logic)

                // 1. Find student (Lean & Selected Fields)

                const student = await Student.findOne({ studentId })

                  .select('visitedStalls scanCount')

                  .session(session)

                  .lean();

    

                if (!student) throw new Error('Student not found'); // Logic error

                

                // 2. Check if already visited

                // @ts-ignore - lean() returns POJO

                if (student.visitedStalls && student.visitedStalls.includes(organizationId)) {

                  throw new Error('Already visited this organization'); // Logic error

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

              

              // Rethrow logic errors immediately to bypass retry loop

              if (error instanceof Error && (

                  error.message.includes('Already visited') || 

                  error.message.includes('Student not found')

              )) {

                 throw error; 

              }

    

              if (attempt === MAX_RETRIES) {

                throw error;

              }

              // Exponential backoff

              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));

            }

          }

          await session.endSession();

          return { success: false };

        }, (error: any) => {

          // Don't count logic errors as system failures

          if (error instanceof Error && (

            error.message.includes('Already visited') || 

            error.message.includes('Student not found')

          )) {

            return false;

          }

          return true;

        });

      } catch (error) {

        throw error;

      }

    }export async function getScansByStudent(studentId: string): Promise<IScan[]> {
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
