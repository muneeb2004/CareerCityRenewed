/**
 * Analytics Scan API Endpoint
 * POST /api/analytics/scan
 * 
 * Records scan events for analytics.
 * Enriches scan data with student information.
 * 
 * Security:
 * - Authentication required (volunteer or higher)
 * - Rate limited (1000 scans per hour per user)
 * - Input validation and sanitization
 * - Deduplication at app and DB level
 * - Audit logging for all scans
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { AnalyticsScan } from '@/models/AnalyticsScan';
import { StudentRecord } from '@/models/StudentRecord';
import { extractStudentId, isValidCombinedId } from '@/lib/student-id';
import { isDuplicate } from '@/lib/deduplication';
import { logUnhandledError } from '@/lib/security-logger';
import {
  checkAuth,
  checkEndpointRateLimit,
  sanitizeInput,
  getClientIp,
} from '@/lib/api-security';
import { logScan, logAccessDenied } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

interface ScanRequest {
  studentId: string;    // Combined ID "xx1234" or "xx12345"
  stallId: string;      // Organization/Stall ID
  timestamp?: string;   // ISO timestamp (optional, defaults to now)
}

interface ScanResponse {
  success: boolean;
  error?: string;
  deduplicated?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
  const ip = getClientIp(request);
  
  try {
    // 1. Authentication check (volunteer or higher)
    const authResult = await checkAuth(request, { requiredRole: 'volunteer' });
    
    if (!authResult.authorized) {
      await logAccessDenied('analytics-scan', authResult.reason || 'unauthorized', ip);
      return authResult.response as NextResponse<ScanResponse>;
    }

    const session = authResult.session!;

    // 2. Parse request body
    let body: ScanRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 3. Sanitize inputs
    const studentId = sanitizeInput(body.studentId || '');
    const stallId = sanitizeInput(body.stallId || '');
    const timestamp = body.timestamp;

    // 4. Validate required fields
    if (!studentId || !stallId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: studentId, stallId' },
        { status: 400 }
      );
    }

    // 5. Validate student ID format
    if (!isValidCombinedId(studentId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid student ID format' },
        { status: 400 }
      );
    }

    // 6. Rate limiting (1000 scans per hour per user)
    const rateLimitCheck = await checkEndpointRateLimit(request, 'scan', session.username);
    if (!rateLimitCheck.allowed) {
      await logAccessDenied('analytics-scan', 'rate_limited', ip, session.username);
      return rateLimitCheck.response as NextResponse<ScanResponse>;
    }

    // 7. Deduplication check
    const dedupKey = `analytics-scan:${studentId}:${stallId}`;
    if (isDuplicate(dedupKey)) {
      console.log(`[DEDUP] Duplicate analytics scan prevented for ${studentId} at ${stallId}`);
      return NextResponse.json({ success: true, deduplicated: true });
    }

    // 8. Extract student ID from combined format
    const extractedId = extractStudentId(studentId);
    if (!extractedId) {
      return NextResponse.json(
        { success: false, error: 'Could not extract student ID' },
        { status: 400 }
      );
    }

    // 9. Connect to database
    await dbConnect();

    // 10. Find student record for enrichment (optional - scan still records if student not found)
    const studentRecord = await StudentRecord.findOne(
      { id: extractedId },
      { classYear: 1, major: 1, name: 1 }
    ).lean();

    // 11. Parse timestamp
    const scanTimestamp = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(scanTimestamp.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    // 12. Create analytics scan record
    try {
      await AnalyticsScan.create({
        studentId: studentId,
        extractedId,
        stallId: stallId,
        timestamp: scanTimestamp,
        classYear: studentRecord?.classYear,
        major: studentRecord?.major,
        name: studentRecord?.name,
        recordedBy: session.username,
      });

      // 13. Log scan in audit log
      await logScan(studentId, stallId, session.username, session.role, ip);

      console.log(`[Analytics] Scan recorded: ${studentId} at ${stallId} by ${session.username}`);

      return NextResponse.json({ success: true });

    } catch (dbError: unknown) {
      // Handle duplicate key error (unique index violation)
      if (dbError && typeof dbError === 'object' && 'code' in dbError && dbError.code === 11000) {
        console.log(`[Analytics] Duplicate scan (DB level): ${studentId} at ${stallId}`);
        return NextResponse.json({ success: true, deduplicated: true });
      }
      throw dbError;
    }

  } catch (error) {
    console.error('Analytics scan error:', error);
    await logUnhandledError(error, 'analytics-scan');
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve scan analytics (for staff)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  
  try {
    // Only staff can view analytics
    const authResult = await checkAuth(request, { requiredRole: 'staff' });
    
    if (!authResult.authorized) {
      await logAccessDenied('analytics-view', authResult.reason || 'unauthorized', ip);
      return authResult.response!;
    }

    await dbConnect();
    
    // Return basic scan statistics
    const totalScans = await AnalyticsScan.countDocuments();
    const uniqueStudents = await AnalyticsScan.distinct('extractedId').then(arr => arr.length);
    const uniqueStalls = await AnalyticsScan.distinct('stallId').then(arr => arr.length);
    
    return NextResponse.json({
      totalScans,
      uniqueStudents,
      uniqueStalls,
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
