/**
 * Student Validation API Endpoint
 * GET /api/students/validate/:id
 * 
 * Validates if a student ID exists in the database.
 * Rate limited, no authentication required.
 * Never exposes personal student data.
 * 
 * Security:
 * - Rate limited (100 requests per minute per IP)
 * - Input validation (format check)
 * - Timing attack prevention
 * - Suspicious activity detection
 * - Audit logging for failed attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { StudentRecord } from '@/models/StudentRecord';
import { extractStudentId } from '@/lib/student-id';
import { getRateLimitHeaders } from '@/lib/rate-limit';
import {
  checkEndpointRateLimit,
  isValidCombinedIdFormat,
  addRandomDelay,
  getClientIp,
} from '@/lib/api-security';
import { logValidation, checkSuspiciousValidationPattern } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

interface ValidateResponse {
  valid: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ValidateResponse | { error: string }>> {
  const ip = getClientIp(request);
  
  try {
    const { id: combinedId } = await params;
    
    // 1. Rate limiting check (100 requests per minute per IP)
    const rateLimitCheck = await checkEndpointRateLimit(request, 'validate', ip);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response as NextResponse<ValidateResponse | { error: string }>;
    }

    // 2. Check for suspicious patterns (many failed attempts)
    const isSuspicious = await checkSuspiciousValidationPattern(ip);
    if (isSuspicious) {
      // Add longer delay for suspicious IPs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Validate input format before processing
    if (!isValidCombinedIdFormat(combinedId)) {
      // Log failed validation attempt
      await logValidation(combinedId || 'empty', false, ip);
      
      // Add random delay to prevent timing attacks
      await addRandomDelay();
      
      return NextResponse.json({ valid: false });
    }

    // 4. Extract student ID from combined format
    const extractedId = extractStudentId(combinedId);
    
    if (!extractedId) {
      await logValidation(combinedId, false, ip);
      await addRandomDelay();
      return NextResponse.json({ valid: false });
    }

    // 5. Connect to database
    await dbConnect();

    // 6. Query for student - only check existence
    const student = await StudentRecord.findOne(
      { id: extractedId },
      { _id: 1 } // Only return _id to minimize data exposure
    ).lean();

    const isValid = !!student;
    
    // 7. Log validation attempt
    await logValidation(combinedId, isValid, ip);

    // 8. Add random delay to prevent timing attacks
    await addRandomDelay();

    // 9. Return validation result only (never expose reasons)
    return NextResponse.json({ valid: isValid });

  } catch (error) {
    console.error('Validation error:', error);
    
    // Add delay even on errors
    await addRandomDelay();
    
    // Don't expose error details - always return valid: false
    return NextResponse.json({ valid: false });
  }
}
