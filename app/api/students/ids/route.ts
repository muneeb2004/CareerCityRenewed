/**
 * Student IDs List API Endpoint
 * GET /api/students/ids
 * 
 * Returns list of all student IDs for offline validation.
 * Requires authentication (staff or volunteer).
 * No personal data included.
 * 
 * Security:
 * - Authentication required (staff or volunteer role)
 * - Rate limited (10 requests per hour per user)
 * - Audit logging for all downloads
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { StudentRecord } from '@/models/StudentRecord';
import { checkAuth, checkEndpointRateLimit, getClientIp } from '@/lib/api-security';
import { logIdListDownload, logAccessDenied } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

interface IDsResponse {
  ids: string[];
  count: number;
  lastUpdated: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<IDsResponse | { error: string }>> {
  const ip = getClientIp(request);
  
  try {
    // 1. Authentication check (staff or volunteer required)
    const authResult = await checkAuth(request, { requiredRole: 'volunteer' });
    
    if (!authResult.authorized) {
      await logAccessDenied('ids-list', authResult.reason || 'unauthorized', ip);
      return authResult.response as NextResponse<IDsResponse | { error: string }>;
    }

    const session = authResult.session!;

    // 2. Rate limiting (10 downloads per hour)
    const rateLimitCheck = await checkEndpointRateLimit(request, 'ids', session.username);
    if (!rateLimitCheck.allowed) {
      await logAccessDenied('ids-list', 'rate_limited', ip, session.username);
      return rateLimitCheck.response as NextResponse<IDsResponse | { error: string }>;
    }

    // 3. Connect to database
    await dbConnect();

    // 4. Query only IDs - no personal data
    const students = await StudentRecord.find(
      {},
      { id: 1, _id: 0 }
    ).lean();

    const ids = students.map(s => s.id);

    // 5. Log the download
    await logIdListDownload(session.username, session.role, ip, ids.length);

    // 6. Get last update time
    const latestStudent = await StudentRecord.findOne().sort({ createdAt: -1 }).lean();
    const lastUpdated = latestStudent?.createdAt 
      ? new Date(latestStudent.createdAt).toISOString() 
      : new Date().toISOString();

    // 7. Return IDs list
    return NextResponse.json(
      { 
        ids, 
        count: ids.length,
        lastUpdated,
      },
      { 
        headers: {
          'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        }
      }
    );

  } catch (error) {
    console.error('Error fetching student IDs:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
