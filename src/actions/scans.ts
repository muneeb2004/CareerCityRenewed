'use server';

import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Scan, IScan } from '@/models/Scan';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';
import { isDuplicate } from '@/lib/deduplication';
import { checkRateLimit } from '@/lib/rate-limit';
import { dbBreaker } from '@/lib/circuit-breaker';
import { RecordVisitSchema, StudentIdSchema, OrganizationIdSchema, validateOrThrow } from '@/lib/schemas';
import { safeEquals } from '@/lib/sanitize';
import { handleError } from '@/lib/error-handler';
import { 
  logScanOperation, 
  logRateLimitExceeded, 
  logUnhandledError 
} from '@/lib/security-logger';

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
  // Validate all inputs first
  const validated = validateOrThrow(RecordVisitSchema, {
    studentId,
    studentEmail,
    studentProgram,
    organizationId,
    organizationName,
    boothNumber,
  });

  // 0. Rate Limit Check (using 'scan' endpoint type)
  const rateLimit = checkRateLimit(validated.studentId, 'scan');
  if (!rateLimit.allowed) {
    // Log rate limit exceeded
    await logRateLimitExceeded(validated.studentId, 'recordVisit');
    throw new Error(rateLimit.message || 'Too many requests. Please wait a moment.');
  }

  // 1. Deduplication check
  const dedupKey = `scan:${validated.studentId}:${validated.organizationId}`;
  if (isDuplicate(dedupKey)) {
    console.log(`[DEDUP] Duplicate scan prevented for ${validated.studentId} at ${validated.organizationId}`);
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

                // 1. Find student (Lean & Selected Fields) - Use safe equals

                const student = await Student.findOne({ studentId: safeEquals(validated.studentId) })

                  .select('visitedStalls scanCount')

                  .session(session)

                  .lean();

    

                if (!student) throw new Error('Student not found'); // Logic error

                

                // 2. Check if already visited

                // @ts-ignore - lean() returns POJO

                if (student.visitedStalls && student.visitedStalls.includes(validated.organizationId)) {

                  throw new Error('Already visited this organization'); // Logic error

                }

                

                const newScanCount = (student.scanCount || 0) + 1;

                const scanId = `${validated.studentId}_${newScanCount}`;

    

                // 3. Create scan record with validated data

                await Scan.create([{

                  scanId,

                  studentId: validated.studentId,

                  studentEmail: validated.studentEmail,

                  studentProgram: validated.studentProgram,

                  organizationId: validated.organizationId,

                  organizationName: validated.organizationName,

                  boothNumber: validated.boothNumber,

                  timestamp: new Date(),

                  scanMethod: 'qr_code'

                }], { session });

                

                // 4. Update student - Use safe equals

                await Student.updateOne(

                  { studentId: safeEquals(validated.studentId) },

                  { 

                    $inc: { scanCount: 1 },

                    $push: { visitedStalls: validated.organizationId },

                    $set: { lastScanTime: new Date() }

                  }

                ).session(session);

                

                // 5. Update organization - Use safe equals

                await Organization.updateOne(

                  { organizationId: safeEquals(validated.organizationId) },

                  { 

                    $inc: { visitorCount: 1 },

                    $push: { visitors: validated.studentId }

                  }

                ).session(session);

    

              }, {

                readPreference: 'primary',

                readConcern: { level: 'snapshot' },

                writeConcern: { w: 'majority' },

                maxCommitTimeMS: TRANSACTION_TIMEOUT

              });

              

              console.log(`Visit recorded successfully for ${validated.studentId} at ${validated.organizationId}`);
              
              // Log successful scan
              await logScanOperation(validated.studentId, validated.organizationId, true);

    

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
        // Log failed scan
        await logScanOperation(studentId, organizationId, false, error instanceof Error ? error.message : 'Unknown error');
        
        const handled = handleError(error);

        throw new Error(handled.message);

      }

    }

export async function getScansByStudent(studentId: string): Promise<IScan[]> {
  await dbConnect();
  
  try {
    // Validate input
    const validatedStudentId = validateOrThrow(StudentIdSchema, studentId);
    
    const scans = await Scan.find({ studentId: safeEquals(validatedStudentId) })
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
    // Validate input
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    
    const scans = await Scan.find({ organizationId: safeEquals(validatedOrgId) })
      .sort({ timestamp: -1 })
      .lean();

    return scans.map(serializeScan);
  } catch (error) {
    console.error('Error getting scans by organization:', error);
    return [];
  }
}
