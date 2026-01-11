'use server';

import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';

/**
 * Security Event Logging Module
 * OWASP A09:2021 - Security Logging and Monitoring Failures
 * 
 * Provides comprehensive logging for:
 * - Authentication events (login/logout/failures)
 * - Access control events (unauthorized access attempts)
 * - Critical operations (data modifications)
 * - Suspicious activities (injection attempts, rate limit hits)
 */

// =============================================================================
// Types & Interfaces
// =============================================================================

export type SecurityEventType = 
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.logout'
  | 'auth.session_expired'
  | 'auth.token_invalid'
  | 'access.unauthorized'
  | 'access.forbidden'
  | 'access.resource_created'
  | 'access.resource_updated'
  | 'access.resource_deleted'
  | 'rate_limit.exceeded'
  | 'rate_limit.warning'
  | 'validation.failure'
  | 'validation.injection_attempt'
  | 'data.integrity_failure'
  | 'suspicious.pattern_detected'
  | 'suspicious.brute_force'
  | 'error.unhandled';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export interface LogContext {
  userId?: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique request ID for log correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get client IP address from headers
 */
export async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') || // Cloudflare
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

/**
 * Get user agent from headers
 */
export async function getUserAgent(): Promise<string> {
  try {
    const headersList = await headers();
    return headersList.get('user-agent') || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Mask sensitive data in logs
 */
function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) return '****';
  return data.substring(0, visibleChars) + '****';
}

/**
 * Sanitize metadata to prevent log injection
 */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Remove newlines and control characters that could enable log injection
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/[\r\n\t]/g, ' ').substring(0, 500);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = null;
    } else {
      // For objects/arrays, stringify and truncate
      try {
        sanitized[key] = JSON.stringify(value).substring(0, 500);
      } catch {
        sanitized[key] = '[unserializable]';
      }
    }
  }
  
  return sanitized;
}

// =============================================================================
// Core Logging Function
// =============================================================================

/**
 * Log a security event
 * In production, this would send to a SIEM or logging service
 */
export async function logSecurityEvent(
  type: SecurityEventType,
  severity: SecuritySeverity,
  message: string,
  context?: LogContext
): Promise<void> {
  const event: SecurityEvent = {
    type,
    severity,
    message,
    userId: context?.userId ? maskSensitiveData(context.userId, 4) : undefined,
    ip: await getClientIp(),
    userAgent: await getUserAgent(),
    resource: context?.resource,
    action: context?.action,
    metadata: sanitizeMetadata(context?.metadata),
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  };

  // Format for structured logging
  const logEntry = {
    level: severityToLogLevel(severity),
    category: 'SECURITY',
    ...event,
  };

  // Log based on severity
  switch (severity) {
    case 'critical':
    case 'high':
      console.error('[SECURITY]', JSON.stringify(logEntry));
      break;
    case 'medium':
      console.warn('[SECURITY]', JSON.stringify(logEntry));
      break;
    default:
      console.log('[SECURITY]', JSON.stringify(logEntry));
  }

  // In production, send to external monitoring service
  if (process.env.NODE_ENV === 'production') {
    await sendToMonitoringService(event);
  }
}

function severityToLogLevel(severity: SecuritySeverity): string {
  const levels: Record<SecuritySeverity, string> = {
    low: 'info',
    medium: 'warn',
    high: 'error',
    critical: 'fatal',
  };
  return levels[severity];
}

/**
 * Send critical events to Sentry monitoring
 */
async function sendToMonitoringService(event: SecurityEvent): Promise<void> {
  // Only send high/critical severity events to Sentry
  if (event.severity === 'critical' || event.severity === 'high') {
    const sentryLevel = event.severity === 'critical' ? 'fatal' : 'error';
    
    Sentry.withScope((scope) => {
      // Set user context if available
      if (event.userId) {
        scope.setUser({ id: event.userId });
      }
      
      // Set tags for filtering
      scope.setTags({
        'security.type': event.type,
        'security.severity': event.severity,
        'security.resource': event.resource || 'unknown',
      });
      
      // Add extra context
      scope.setExtras({
        ip: event.ip,
        userAgent: event.userAgent,
        action: event.action,
        requestId: event.requestId,
        timestamp: event.timestamp,
        ...event.metadata,
      });
      
      // Capture as message with appropriate level
      Sentry.captureMessage(`[Security] ${event.type}: ${event.message}`, sentryLevel);
    });
  }
  
  // For medium severity, capture as warning breadcrumb
  if (event.severity === 'medium') {
    Sentry.addBreadcrumb({
      category: 'security',
      message: `${event.type}: ${event.message}`,
      level: 'warning',
      data: {
        userId: event.userId,
        resource: event.resource,
        ip: event.ip,
      },
    });
  }
}

// =============================================================================
// Authentication Event Loggers
// =============================================================================

/**
 * Log successful login
 */
export async function logLoginSuccess(username: string, role?: string): Promise<void> {
  await logSecurityEvent(
    'auth.login_success',
    'low',
    `Successful login for user`,
    {
      userId: username,
      action: 'login',
      metadata: { role },
    }
  );
}

/**
 * Log failed login attempt
 */
export async function logLoginFailure(
  username: string,
  reason: string = 'invalid_credentials'
): Promise<void> {
  await logSecurityEvent(
    'auth.login_failure',
    'medium',
    `Failed login attempt: ${reason}`,
    {
      userId: username,
      action: 'login',
      metadata: { reason },
    }
  );
}

/**
 * Log logout event
 */
export async function logLogout(username: string): Promise<void> {
  await logSecurityEvent(
    'auth.logout',
    'low',
    'User logged out',
    {
      userId: username,
      action: 'logout',
    }
  );
}

/**
 * Log session expiration
 */
export async function logSessionExpired(userId?: string): Promise<void> {
  await logSecurityEvent(
    'auth.session_expired',
    'low',
    'Session expired',
    { userId }
  );
}

/**
 * Log invalid token attempt
 */
export async function logInvalidToken(reason: string = 'invalid'): Promise<void> {
  await logSecurityEvent(
    'auth.token_invalid',
    'medium',
    `Invalid token: ${reason}`,
    {
      action: 'token_verification',
      metadata: { reason },
    }
  );
}

// =============================================================================
// Access Control Event Loggers
// =============================================================================

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  resource: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'access.unauthorized',
    'high',
    `Unauthorized access attempt to ${resource}`,
    {
      userId,
      resource,
      action: 'access_denied',
    }
  );
}

/**
 * Log forbidden access (authenticated but not allowed)
 */
export async function logForbiddenAccess(
  resource: string,
  userId: string,
  requiredRole?: string
): Promise<void> {
  await logSecurityEvent(
    'access.forbidden',
    'high',
    `Forbidden access: insufficient permissions for ${resource}`,
    {
      userId,
      resource,
      action: 'forbidden',
      metadata: { requiredRole },
    }
  );
}

/**
 * Log resource creation
 */
export async function logResourceCreated(
  resource: string,
  resourceId: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'access.resource_created',
    'low',
    `Resource created: ${resource}`,
    {
      userId,
      resource,
      action: 'create',
      metadata: { resourceId: maskSensitiveData(resourceId, 6) },
    }
  );
}

/**
 * Log resource update
 */
export async function logResourceUpdated(
  resource: string,
  resourceId: string,
  userId?: string,
  changes?: string[]
): Promise<void> {
  await logSecurityEvent(
    'access.resource_updated',
    'low',
    `Resource updated: ${resource}`,
    {
      userId,
      resource,
      action: 'update',
      metadata: { 
        resourceId: maskSensitiveData(resourceId, 6),
        changes: changes?.slice(0, 10), // Limit to 10 fields
      },
    }
  );
}

/**
 * Log resource deletion
 */
export async function logResourceDeleted(
  resource: string,
  resourceId: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'access.resource_deleted',
    'medium',
    `Resource deleted: ${resource}`,
    {
      userId,
      resource,
      action: 'delete',
      metadata: { resourceId: maskSensitiveData(resourceId, 6) },
    }
  );
}

// =============================================================================
// Rate Limiting Event Loggers
// =============================================================================

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
  userId?: string,
  endpoint?: string
): Promise<void> {
  await logSecurityEvent(
    'rate_limit.exceeded',
    'medium',
    'Rate limit exceeded',
    {
      userId,
      resource: endpoint,
      action: 'rate_limit',
    }
  );
}

/**
 * Log rate limit warning (approaching limit)
 */
export async function logRateLimitWarning(
  userId?: string,
  remaining?: number
): Promise<void> {
  await logSecurityEvent(
    'rate_limit.warning',
    'low',
    'Approaching rate limit',
    {
      userId,
      metadata: { remaining },
    }
  );
}

// =============================================================================
// Validation & Security Event Loggers
// =============================================================================

/**
 * Log validation failure
 */
export async function logValidationFailure(
  field: string,
  reason: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'validation.failure',
    'low',
    `Validation failed for ${field}: ${reason}`,
    {
      userId,
      action: 'validation',
      metadata: { field, reason },
    }
  );
}

/**
 * Log potential injection attempt
 */
export async function logInjectionAttempt(
  type: 'sql' | 'nosql' | 'xss' | 'command',
  input: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'validation.injection_attempt',
    'critical',
    `Potential ${type.toUpperCase()} injection attempt detected`,
    {
      userId,
      action: 'injection_detection',
      metadata: { 
        type,
        input: maskSensitiveData(input, 10),
      },
    }
  );
}

/**
 * Log data integrity failure
 */
export async function logDataIntegrityFailure(
  resource: string,
  reason: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent(
    'data.integrity_failure',
    'high',
    `Data integrity check failed for ${resource}`,
    {
      userId,
      resource,
      action: 'integrity_check',
      metadata: { reason },
    }
  );
}

// =============================================================================
// Suspicious Activity Loggers
// =============================================================================

/**
 * Log suspicious pattern detected
 */
export async function logSuspiciousActivity(
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent(
    'suspicious.pattern_detected',
    'high',
    description,
    { metadata }
  );
}

/**
 * Log potential brute force attack
 */
export async function logBruteForceAttempt(
  target: string,
  attemptCount: number
): Promise<void> {
  await logSecurityEvent(
    'suspicious.brute_force',
    'critical',
    `Potential brute force attack on ${target}`,
    {
      resource: target,
      metadata: { attemptCount },
    }
  );
}

/**
 * Log unhandled error (for monitoring)
 */
export async function logUnhandledError(
  error: unknown,
  context?: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack?.substring(0, 500) : undefined;
  
  await logSecurityEvent(
    'error.unhandled',
    'high',
    `Unhandled error${context ? ` in ${context}` : ''}: ${errorMessage}`,
    {
      metadata: {
        errorType: error?.constructor?.name,
        stack: errorStack,
        context,
      },
    }
  );
}

// =============================================================================
// Composite Loggers for Common Operations
// =============================================================================

/**
 * Log a QR scan operation
 */
export async function logScanOperation(
  studentId: string,
  organizationId: string,
  success: boolean,
  reason?: string
): Promise<void> {
  await logSecurityEvent(
    success ? 'access.resource_created' : 'validation.failure',
    success ? 'low' : 'medium',
    success ? 'QR scan recorded' : `QR scan failed: ${reason}`,
    {
      userId: studentId,
      resource: 'scan',
      action: success ? 'create' : 'failed',
      metadata: {
        organizationId: maskSensitiveData(organizationId, 6),
        success,
        reason,
      },
    }
  );
}

/**
 * Log feedback submission
 */
export async function logFeedbackSubmission(
  entityType: 'student' | 'organization',
  entityId: string,
  success: boolean
): Promise<void> {
  await logSecurityEvent(
    success ? 'access.resource_created' : 'validation.failure',
    'low',
    success 
      ? `${entityType} feedback submitted` 
      : `${entityType} feedback submission failed`,
    {
      userId: entityId,
      resource: `${entityType}_feedback`,
      action: success ? 'create' : 'failed',
    }
  );
}

/**
 * Log student registration
 */
export async function logStudentRegistration(
  studentId: string,
  success: boolean,
  reason?: string
): Promise<void> {
  await logSecurityEvent(
    success ? 'access.resource_created' : 'validation.failure',
    success ? 'low' : 'medium',
    success ? 'Student registered' : `Student registration failed: ${reason}`,
    {
      userId: studentId,
      resource: 'student',
      action: success ? 'register' : 'failed',
      metadata: reason ? { reason } : undefined,
    }
  );
}

/**
 * Log organization management operation
 */
export async function logOrganizationOperation(
  operation: 'create' | 'update' | 'delete',
  organizationId: string,
  adminUser?: string,
  success: boolean = true
): Promise<void> {
  const actionMap = {
    create: 'access.resource_created',
    update: 'access.resource_updated',
    delete: 'access.resource_deleted',
  } as const;

  await logSecurityEvent(
    success ? actionMap[operation] : 'validation.failure',
    operation === 'delete' ? 'medium' : 'low',
    `Organization ${operation}${success ? 'd' : ' failed'}`,
    {
      userId: adminUser,
      resource: 'organization',
      action: operation,
      metadata: { organizationId: maskSensitiveData(organizationId, 6) },
    }
  );
}
/**
 * Log data access operation (for audit trail)
 */
export async function logDataAccess(
  userId: string,
  resource: string,
  action: 'read' | 'write' | 'delete'
): Promise<void> {
  const eventType = action === 'read' 
    ? 'access.resource_created' as const
    : action === 'write' 
      ? 'access.resource_updated' as const 
      : 'access.resource_deleted' as const;
      
  await logSecurityEvent(
    eventType,
    'low',
    `Data ${action} operation on ${resource}`,
    {
      userId,
      resource,
      action,
    }
  );
}