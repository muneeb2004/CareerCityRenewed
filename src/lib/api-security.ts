/**
 * API Security Utilities
 * 
 * Provides authentication, authorization, rate limiting, and input validation
 * for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession, StaffSession } from '@/lib/auth';
import { checkRateLimit, getRateLimitHeaders, RateLimitResult } from '@/lib/rate-limit';
import { logAccessDenied, logRateLimit } from '@/lib/audit-logger';

// =============================================================================
// Types
// =============================================================================

export interface AuthResult {
  authorized: boolean;
  session: StaffSession | null;
  reason?: string;
  response?: NextResponse;
}

export interface AuthOptions {
  requiredRole?: 'admin' | 'staff' | 'volunteer';
  requireAuth?: boolean;
}

// =============================================================================
// Rate Limit Configurations
// =============================================================================

// Custom rate limit configs for specific endpoints
export const ENDPOINT_RATE_LIMITS = {
  // Validation endpoint - prevent ID enumeration
  'validate': {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,
    message: 'Too many validation requests. Please slow down.',
  },
  // ID list download - prevent mass downloads
  'ids': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'ID list download limit reached. Please try again later.',
  },
  // Import endpoint - prevent abuse
  'import': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Import limit reached. Please try again later.',
  },
  // Analytics scan - reasonable usage
  'scan': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    message: 'Scan limit reached. Please try again later.',
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get client IP from request
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Check if user has required role
 */
function hasRequiredRole(session: StaffSession, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    'volunteer': 1,
    'staff': 2,
    'admin': 3,
  };
  
  const userRoleLevel = roleHierarchy[session.role?.toLowerCase()] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole.toLowerCase()] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
}

// =============================================================================
// Authentication & Authorization
// =============================================================================

/**
 * Check authentication and optionally authorization
 * Returns an AuthResult with authorized status, session, and error response if needed
 */
export async function checkAuth(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const { requiredRole, requireAuth = true } = options;
  
  if (!requireAuth) {
    return { authorized: true, session: null };
  }
  
  try {
    const session = await getStaffSession();
    
    if (!session) {
      return {
        authorized: false,
        session: null,
        reason: 'not_authenticated',
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }
    
    if (requiredRole && !hasRequiredRole(session, requiredRole)) {
      return {
        authorized: false,
        session,
        reason: 'insufficient_permissions',
        response: NextResponse.json(
          { error: `Insufficient permissions. ${requiredRole} role required.` },
          { status: 403 }
        ),
      };
    }
    
    return {
      authorized: true,
      session,
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      authorized: false,
      session: null,
      reason: 'auth_error',
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface CustomRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

// In-memory store for custom rate limits
const customRateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Check custom rate limit
 */
export function checkCustomRateLimit(
  identifier: string,
  config: CustomRateLimitConfig
): RateLimitResult {
  const key = `custom:${identifier}`;
  const now = Date.now();
  
  let record = customRateLimitStore.get(key);
  
  // Check if window has expired
  if (record && now - record.windowStart > config.windowMs) {
    customRateLimitStore.delete(key);
    record = undefined;
  }
  
  // New record
  if (!record) {
    customRateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    const resetAt = record.windowStart + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000),
      message: config.message,
    };
  }
  
  // Increment counter
  record.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetAt: record.windowStart + config.windowMs,
  };
}

/**
 * Check endpoint-specific rate limit
 */
export async function checkEndpointRateLimit(
  request: NextRequest,
  endpointType: keyof typeof ENDPOINT_RATE_LIMITS,
  identifier?: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const config = ENDPOINT_RATE_LIMITS[endpointType];
  const ip = getClientIp(request);
  const key = identifier ? `${endpointType}:${identifier}` : `${endpointType}:${ip}`;
  
  const result = checkCustomRateLimit(key, config);
  
  if (!result.allowed) {
    await logRateLimit(endpointType, key);
    
    return {
      allowed: false,
      response: NextResponse.json(
        { error: result.message || 'Rate limit exceeded' },
        { 
          status: 429,
          headers: getRateLimitHeaders(result),
        }
      ),
    };
  }
  
  return { allowed: true };
}

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Validate combined student ID format (2 letters + 4-5 digits)
 */
export function isValidCombinedIdFormat(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  
  // Must be 6-7 characters (2 prefix + 4-5 digits)
  if (trimmed.length < 6 || trimmed.length > 7) return false;
  
  // First 2 characters should be letters
  const prefix = trimmed.substring(0, 2);
  if (!/^[a-zA-Z]{2}$/.test(prefix)) return false;
  
  // Rest should be digits
  const digits = trimmed.substring(2);
  return /^\d{4,5}$/.test(digits);
}

/**
 * Sanitize string input (prevent NoSQL injection)
 */
export function sanitizeInput(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return null;
  
  // Remove MongoDB operators
  let sanitized = input
    .replace(/\$/g, '')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize object for MongoDB (remove $ operators)
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip keys starting with $
    if (key.startsWith('$')) continue;
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// =============================================================================
// Timing Attack Prevention
// =============================================================================

/**
 * Add random delay to prevent timing attacks (10-50ms)
 */
export async function addRandomDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 40) + 10; // 10-50ms
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Constant-time string comparison
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to maintain constant time
    let result = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a generic error response (no internal details)
 */
export function errorResponse(
  statusCode: number = 500,
  publicMessage: string = 'An error occurred'
): NextResponse {
  return NextResponse.json(
    { error: publicMessage },
    { status: statusCode }
  );
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(message: string = 'Invalid request'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}
