'use server';

import dbConnect from '@/lib/db';
import { StudentRecord, IStudentRecord } from '@/models/StudentRecord';
import { AnalyticsScan, IAnalyticsScan } from '@/models/AnalyticsScan';
import { extractStudentId, isValidCombinedId } from '@/lib/student-id';
import { logDataAccess, logUnhandledError } from '@/lib/security-logger';

/**
 * Server Actions for Student Records
 * Used for managing imported student data
 */

// Helper to serialize MongoDB documents
function serializeStudentRecord(doc: any): Omit<IStudentRecord, '_id'> & { _id: string } {
  return {
    _id: doc._id?.toString() || '',
    id: doc.id,
    classYear: doc.classYear,
    major: doc.major,
    name: doc.name,
    createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
    updatedAt: doc.updatedAt?.toISOString?.() ?? doc.updatedAt,
  };
}

/**
 * Get all student records count
 */
export async function getStudentRecordCount(): Promise<number> {
  try {
    await dbConnect();
    return await StudentRecord.countDocuments();
  } catch (error) {
    console.error('Error getting student record count:', error);
    return 0;
  }
}

/**
 * Get all unique student IDs (for offline validation)
 */
export async function getAllStudentIds(): Promise<string[]> {
  try {
    await dbConnect();
    const records = await StudentRecord.find({}, { id: 1, _id: 0 }).lean();
    return records.map(r => r.id);
  } catch (error) {
    console.error('Error getting student IDs:', error);
    await logUnhandledError(error, 'getAllStudentIds');
    return [];
  }
}

/**
 * Validate a student ID exists
 * @param combinedId - The full ID with prefix (e.g., "xx1234")
 */
export async function validateStudentId(combinedId: string): Promise<boolean> {
  try {
    const extractedId = extractStudentId(combinedId);
    if (!extractedId) return false;

    await dbConnect();
    const record = await StudentRecord.findOne({ id: extractedId }, { _id: 1 }).lean();
    return !!record;
  } catch (error) {
    console.error('Error validating student ID:', error);
    return false;
  }
}

/**
 * Get student record by ID
 * @param combinedId - The full ID with prefix (e.g., "xx1234")
 */
export async function getStudentRecord(combinedId: string): Promise<(Omit<IStudentRecord, '_id'> & { _id: string }) | null> {
  try {
    const extractedId = extractStudentId(combinedId);
    if (!extractedId) return null;

    await dbConnect();
    const record = await StudentRecord.findOne({ id: extractedId }).lean();
    return record ? serializeStudentRecord(record) : null;
  } catch (error) {
    console.error('Error getting student record:', error);
    return null;
  }
}

/**
 * Record an analytics scan
 */
export async function recordAnalyticsScan(
  studentId: string,
  stallId: string,
  timestamp?: Date
): Promise<{ success: boolean; error?: string; deduplicated?: boolean }> {
  try {
    // Validate combined ID format
    if (!isValidCombinedId(studentId)) {
      return { success: false, error: 'Invalid student ID format' };
    }

    const extractedId = extractStudentId(studentId);
    if (!extractedId) {
      return { success: false, error: 'Could not extract student ID' };
    }

    await dbConnect();

    // Get student record for enrichment
    const studentRecord = await StudentRecord.findOne(
      { id: extractedId },
      { classYear: 1, major: 1, name: 1 }
    ).lean();

    // Create scan record
    try {
      await AnalyticsScan.create({
        studentId: studentId.trim(),
        extractedId,
        stallId: stallId.trim(),
        timestamp: timestamp || new Date(),
        classYear: studentRecord?.classYear,
        major: studentRecord?.major,
        name: studentRecord?.name,
      });

      return { success: true };
    } catch (dbError: unknown) {
      // Handle duplicate key error
      if (dbError && typeof dbError === 'object' && 'code' in dbError && dbError.code === 11000) {
        return { success: true, deduplicated: true };
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error recording analytics scan:', error);
    await logUnhandledError(error, 'recordAnalyticsScan');
    return { success: false, error: 'Failed to record scan' };
  }
}

/**
 * Get analytics scans by stall
 */
export async function getAnalyticsScansByStall(stallId: string): Promise<IAnalyticsScan[]> {
  try {
    await dbConnect();
    const scans = await AnalyticsScan.find({ stallId })
      .sort({ timestamp: -1 })
      .lean();
    
    return scans.map(scan => ({
      ...scan,
      _id: scan._id,
      timestamp: scan.timestamp,
      createdAt: scan.createdAt,
    })) as IAnalyticsScan[];
  } catch (error) {
    console.error('Error getting scans by stall:', error);
    return [];
  }
}

/**
 * Get analytics summary by class year
 */
export async function getAnalyticsByClassYear(stallId?: string): Promise<Record<string, number>> {
  try {
    await dbConnect();
    
    const matchStage = stallId ? { stallId } : {};
    
    const results = await AnalyticsScan.aggregate([
      { $match: matchStage },
      { $group: { _id: '$classYear', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const summary: Record<string, number> = {};
    for (const result of results) {
      if (result._id) {
        summary[result._id] = result.count;
      }
    }
    
    return summary;
  } catch (error) {
    console.error('Error getting analytics by class year:', error);
    return {};
  }
}

/**
 * Get analytics summary by major
 */
export async function getAnalyticsByMajor(stallId?: string): Promise<Record<string, number>> {
  try {
    await dbConnect();
    
    const matchStage = stallId ? { stallId } : {};
    
    const results = await AnalyticsScan.aggregate([
      { $match: matchStage },
      { $group: { _id: '$major', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const summary: Record<string, number> = {};
    for (const result of results) {
      if (result._id) {
        summary[result._id] = result.count;
      }
    }
    
    return summary;
  } catch (error) {
    console.error('Error getting analytics by major:', error);
    return {};
  }
}
