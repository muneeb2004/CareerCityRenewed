'use server';

import dbConnect from '@/lib/db';
import { AuditLog, IAuditLog } from '@/models/AuditLog';
import { headers } from 'next/headers';

/**
 * Audit Logger Service
 * Provides functions to log security-relevant actions
 */

// Get client IP from headers
async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

// Get user agent from headers
async function getUserAgent(): Promise<string> {
  try {
    const headersList = await headers();
    return headersList.get('user-agent') || 'unknown';
  } catch {
    return 'unknown';
  }
}

interface AuditLogParams {
  action: IAuditLog['action'];
  userId?: string;
  userRole?: string;
  details?: Record<string, unknown>;
  success: boolean;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await dbConnect();
    
    const ipAddress = params.ipAddress || await getClientIp();
    const userAgent = await getUserAgent();
    
    await AuditLog.create({
      action: params.action,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      details: params.details || {},
      success: params.success,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}

/**
 * Log a CSV import operation
 */
export async function logImport(
  userId: string,
  userRole: string,
  success: boolean,
  details: { imported?: number; updated?: number; skipped?: number; errors?: number }
): Promise<void> {
  await createAuditLog({
    action: 'import',
    userId,
    userRole,
    success,
    details: {
      ...details,
      source: 'StudentData2025.csv',
    },
    resourceType: 'student_records',
  });
}

/**
 * Log a student ID validation attempt
 */
export async function logValidation(
  combinedId: string,
  success: boolean,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    action: 'validate',
    success,
    details: {
      // Don't log the actual ID for privacy, just a hash or partial
      idLength: combinedId?.length || 0,
      idPrefix: combinedId?.substring(0, 2) || 'unknown',
    },
    resourceType: 'student_validation',
    ipAddress,
  });
}

/**
 * Log an ID list download
 */
export async function logIdListDownload(
  userId: string,
  userRole: string,
  ipAddress: string,
  count?: number
): Promise<void> {
  await createAuditLog({
    action: 'download_ids',
    userId,
    userRole,
    success: true,
    details: { count },
    resourceType: 'student_ids',
    ipAddress,
  });
}

/**
 * Log a scan operation
 */
export async function logScan(
  studentId: string,
  stallId: string,
  userId: string,
  userRole: string,
  ipAddress: string
): Promise<void> {
  await createAuditLog({
    action: 'scan',
    userId,
    userRole,
    success: true,
    details: {
      stallId,
      // Partially mask student ID for privacy
      studentIdMasked: studentId ? `${studentId.substring(0, 2)}****` : 'unknown',
    },
    resourceType: 'analytics_scan',
    resourceId: stallId,
    ipAddress,
  });
}

/**
 * Log an access denied event
 */
export async function logAccessDenied(
  endpoint: string,
  reason: string,
  ipAddress?: string,
  userId?: string
): Promise<void> {
  await createAuditLog({
    action: 'access_denied',
    userId,
    success: false,
    details: { endpoint, reason },
    resourceType: 'api_access',
    ipAddress,
  });
}

/**
 * Log a rate limit event
 */
export async function logRateLimit(
  endpoint: string,
  identifier: string
): Promise<void> {
  await createAuditLog({
    action: 'rate_limit',
    success: false,
    details: { 
      endpoint, 
      identifier: identifier.substring(0, 10) + '...' // Partially mask
    },
    resourceType: 'rate_limit',
  });
}

/**
 * Log suspicious activity (multiple failed validations, etc.)
 */
export async function logSuspiciousActivity(
  activityType: string,
  details: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    action: 'suspicious_activity',
    success: false,
    details: {
      activityType,
      ...details,
    },
    resourceType: 'security',
  });
}

/**
 * Check for suspicious validation patterns from an IP
 * Returns true if suspicious activity detected
 */
export async function checkSuspiciousValidationPattern(
  ipAddress: string,
  windowMinutes: number = 5,
  threshold: number = 50
): Promise<boolean> {
  try {
    await dbConnect();
    
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const count = await AuditLog.countDocuments({
      action: 'validate',
      ipAddress,
      success: false,
      timestamp: { $gte: windowStart },
    });
    
    if (count >= threshold) {
      await logSuspiciousActivity('excessive_failed_validations', {
        ipAddress: ipAddress.substring(0, 10) + '...',
        failedCount: count,
        windowMinutes,
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[AuditLog] Failed to check suspicious pattern:', error);
    return false;
  }
}

/**
 * Get recent audit logs (for admin dashboard)
 */
export async function getRecentAuditLogs(
  limit: number = 100,
  filters?: {
    action?: IAuditLog['action'];
    userId?: string;
    success?: boolean;
  }
): Promise<IAuditLog[]> {
  try {
    await dbConnect();
    
    const query: Record<string, unknown> = {};
    if (filters?.action) query.action = filters.action;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.success !== undefined) query.success = filters.success;
    
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    
    return logs as IAuditLog[];
  } catch (error) {
    console.error('[AuditLog] Failed to get recent logs:', error);
    return [];
  }
}
