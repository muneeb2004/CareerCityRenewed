/**
 * Student CSV Import API Endpoint
 * POST /api/admin/import-students
 * 
 * Imports student data from CSV file into MongoDB.
 * Requires admin authentication.
 * 
 * Security:
 * - Admin role required
 * - Rate limited (5 requests per hour)
 * - Audit logged
 */

import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'papaparse';
import { promises as fs } from 'fs';
import path from 'path';
import dbConnect from '@/lib/db';
import { StudentRecord } from '@/models/StudentRecord';
import { normalizeStudentId } from '@/lib/student-id';
import { logUnhandledError } from '@/lib/security-logger';
import { 
  checkAuth, 
  checkEndpointRateLimit, 
  unauthorizedResponse, 
  forbiddenResponse,
  getClientIp,
  errorResponse 
} from '@/lib/api-security';
import { logImport, logAccessDenied } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

interface CSVRow {
  ID: string;
  'Class Year': string;
  Major: string;
  'Student Name': string;
  School?: string;
  Status?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; id: string; error: string }>;
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult | { error: string }>> {
  const ip = getClientIp(request);
  
  try {
    // 1. Check admin authentication (admin role required)
    const authResult = await checkAuth(request, { requiredRole: 'admin' });
    
    if (!authResult.authorized) {
      await logAccessDenied('/api/admin/import-students', authResult.reason || 'unauthorized', ip);
      return authResult.response as NextResponse<ImportResult | { error: string }>;
    }
    
    const session = authResult.session!;

    // 2. Check rate limit (5 requests per hour per admin)
    const rateLimitCheck = await checkEndpointRateLimit(request, 'import', session.username);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response as NextResponse<ImportResult | { error: string }>;
    }

    // 3. Read CSV file from /data directory
    const csvPath = path.join(process.cwd(), 'data', 'StudentData2025.csv');
    
    let csvContent: string;
    try {
      csvContent = await fs.readFile(csvPath, 'utf-8');
    } catch (fileError) {
      console.error('Failed to read CSV file:', fileError);
      return NextResponse.json(
        { error: 'CSV file not found at /data/StudentData2025.csv' },
        { status: 404 }
      );
    }

    // 3. Parse CSV
    const parseResult = parse<CSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
      return NextResponse.json(
        { error: `CSV parsing failed: ${parseResult.errors[0].message}` },
        { status: 400 }
      );
    }

    if (!parseResult.data || parseResult.data.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or could not be parsed' },
        { status: 400 }
      );
    }

    // 4. Connect to database
    await dbConnect();

    // 5. Process each row
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const bulkOps: Array<{
      updateOne: {
        filter: { id: string };
        update: { $set: object };
        upsert: boolean;
      };
    }> = [];

    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i];
      const rowNumber = i + 2; // +2 for header row and 0-indexing

      // Validate and normalize student ID
      const studentId = normalizeStudentId(row.ID);
      if (!studentId) {
        result.errors.push({
          row: rowNumber,
          id: row.ID || 'unknown',
          error: 'Invalid or missing student ID',
        });
        result.skipped++;
        continue;
      }

      // Validate required fields
      const classYear = row['Class Year']?.trim();
      const major = row.Major?.trim();
      const name = row['Student Name']?.trim();

      if (!classYear || !major || !name) {
        result.errors.push({
          row: rowNumber,
          id: studentId,
          error: 'Missing required fields (Class Year, Major, or Student Name)',
        });
        result.skipped++;
        continue;
      }

      // Add to bulk operation
      bulkOps.push({
        updateOne: {
          filter: { id: studentId },
          update: {
            $set: {
              id: studentId,
              classYear,
              major,
              name,
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    // 7. Execute bulk upsert
    if (bulkOps.length > 0) {
      const bulkResult = await StudentRecord.bulkWrite(bulkOps, { ordered: false });
      result.imported = bulkResult.upsertedCount;
      result.updated = bulkResult.modifiedCount;
    }

    // 8. Audit log the import
    await logImport(session.username, session.role, true, {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    console.log(`[Import] Completed: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Import error:', error);
    await logUnhandledError(error, 'import-students');
    
    // Generic error message - don't expose internal details
    return NextResponse.json(
      { error: 'Import failed. Please try again later.' },
      { status: 500 }
    );
  }
}
