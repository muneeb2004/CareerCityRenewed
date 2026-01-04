/**
 * CSRF Protection Utilities
 * OWASP A01:2021 - Broken Access Control
 * 
 * Enhanced CSRF protection beyond Next.js built-in protections:
 * - Double Submit Cookie pattern
 * - Custom CSRF tokens
 * - Origin validation
 * - Request verification
 */

import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { logSuspiciousActivity } from './security-logger';

// =============================================================================
// Configuration
// =============================================================================

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get secret for signing tokens
function getSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('No CSRF secret configured');
  }
  return secret;
}

// =============================================================================
// Types
// =============================================================================

export interface CsrfToken {
  token: string;
  timestamp: number;
  signature: string;
}

export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    reason: string;
    expected?: string;
    received?: string;
  };
}

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const timestamp = Date.now();
  const signature = signToken(token, timestamp);
  
  // Encode as base64 JSON
  const csrfToken: CsrfToken = { token, timestamp, signature };
  return Buffer.from(JSON.stringify(csrfToken)).toString('base64');
}

/**
 * Sign a token with timestamp
 */
function signToken(token: string, timestamp: number): string {
  const secret = getSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${token}:${timestamp}`)
    .digest('hex');
}

/**
 * Verify token signature
 */
function verifyTokenSignature(token: string, timestamp: number, signature: string): boolean {
  const expectedSignature = signToken(token, timestamp);
  
  // Constant-time comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// =============================================================================
// Token Validation
// =============================================================================

/**
 * Parse a CSRF token
 */
function parseToken(encodedToken: string): CsrfToken | null {
  try {
    const json = Buffer.from(encodedToken, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    
    if (!parsed.token || !parsed.timestamp || !parsed.signature) {
      return null;
    }
    
    return parsed as CsrfToken;
  } catch {
    return null;
  }
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(encodedToken: string): CsrfValidationResult {
  // Parse token
  const parsed = parseToken(encodedToken);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid token format',
      details: { reason: 'parse_error' },
    };
  }
  
  const { token, timestamp, signature } = parsed;
  
  // Check expiry
  const age = Date.now() - timestamp;
  if (age > CSRF_TOKEN_EXPIRY_MS) {
    return {
      valid: false,
      error: 'Token expired',
      details: { reason: 'expired' },
    };
  }
  
  // Verify signature
  if (!verifyTokenSignature(token, timestamp, signature)) {
    return {
      valid: false,
      error: 'Invalid token signature',
      details: { reason: 'signature_invalid' },
    };
  }
  
  return { valid: true };
}

// =============================================================================
// Cookie Management
// =============================================================================

/**
 * Set CSRF cookie with a new token
 */
export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  
  cookies().set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_TOKEN_EXPIRY_MS / 1000,
  });
  
  return token;
}

/**
 * Get CSRF token from cookie
 */
export function getCsrfCookie(): string | undefined {
  return cookies().get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Clear CSRF cookie
 */
export function clearCsrfCookie(): void {
  cookies().delete(CSRF_COOKIE_NAME);
}

// =============================================================================
// Request Validation
// =============================================================================

/**
 * Validate CSRF for a request (Double Submit Cookie pattern)
 */
export async function validateCsrfRequest(): Promise<CsrfValidationResult> {
  // Get token from cookie
  const cookieToken = getCsrfCookie();
  if (!cookieToken) {
    return {
      valid: false,
      error: 'CSRF cookie not found',
      details: { reason: 'no_cookie' },
    };
  }
  
  // Get token from header
  const headerToken = headers().get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return {
      valid: false,
      error: 'CSRF header not found',
      details: { reason: 'no_header' },
    };
  }
  
  // Compare tokens (they should match)
  if (cookieToken !== headerToken) {
    await logSuspiciousActivity('CSRF token mismatch', {
      cookiePresent: !!cookieToken,
      headerPresent: !!headerToken,
    });
    
    return {
      valid: false,
      error: 'CSRF token mismatch',
      details: { 
        reason: 'token_mismatch',
        expected: cookieToken.slice(0, 10) + '...',
        received: headerToken.slice(0, 10) + '...',
      },
    };
  }
  
  // Validate token itself
  const tokenValidation = validateCsrfToken(cookieToken);
  if (!tokenValidation.valid) {
    return tokenValidation;
  }
  
  return { valid: true };
}

// =============================================================================
// Origin Validation
// =============================================================================

/**
 * Validate request origin
 */
export async function validateOrigin(): Promise<CsrfValidationResult> {
  const origin = headers().get('origin');
  const host = headers().get('host');
  const referer = headers().get('referer');
  
  // If no origin header, check referer
  const sourceOrigin = origin || (referer ? new URL(referer).origin : null);
  
  if (!sourceOrigin) {
    // Allow requests without origin (same-origin requests often don't have it)
    return { valid: true };
  }
  
  // Get allowed origins
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  try {
    const parsedOrigin = new URL(sourceOrigin);
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      
      try {
        const parsedAllowed = new URL(allowed);
        return parsedOrigin.origin === parsedAllowed.origin;
      } catch {
        // Check if it's just a hostname pattern
        return parsedOrigin.hostname === allowed || 
               parsedOrigin.hostname.endsWith(`.${allowed}`);
      }
    });
    
    if (!isAllowed) {
      await logSuspiciousActivity('Origin validation failed', {
        origin: sourceOrigin,
        host,
        allowedOrigins,
      });
      
      return {
        valid: false,
        error: 'Origin not allowed',
        details: {
          reason: 'origin_not_allowed',
          received: sourceOrigin,
        },
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid origin format',
      details: { reason: 'origin_invalid' },
    };
  }
  
  return { valid: true };
}

/**
 * Get list of allowed origins
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  
  // Add configured origins
  const configuredOrigins = process.env.ALLOWED_ORIGINS;
  if (configuredOrigins) {
    origins.push(...configuredOrigins.split(',').map(o => o.trim()));
  }
  
  // Add app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (appUrl) {
    origins.push(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
  }
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }
  
  return origins;
}

// =============================================================================
// Combined Validation
// =============================================================================

/**
 * Perform full CSRF validation (origin + token)
 */
export async function validateRequest(): Promise<CsrfValidationResult> {
  // Validate origin first
  const originResult = await validateOrigin();
  if (!originResult.valid) {
    return originResult;
  }
  
  // Then validate CSRF token
  const csrfResult = await validateCsrfRequest();
  return csrfResult;
}

// =============================================================================
// Server Action Protection
// =============================================================================

/**
 * CSRF protection wrapper for server actions
 */
export async function withCsrfProtection<T>(
  action: () => Promise<T>
): Promise<T> {
  const validation = await validateRequest();
  
  if (!validation.valid) {
    throw new Error(`CSRF validation failed: ${validation.error}`);
  }
  
  return action();
}

/**
 * Origin-only protection (lighter weight)
 */
export async function withOriginProtection<T>(
  action: () => Promise<T>
): Promise<T> {
  const validation = await validateOrigin();
  
  if (!validation.valid) {
    throw new Error(`Origin validation failed: ${validation.error}`);
  }
  
  return action();
}

// =============================================================================
// React Hook Support
// =============================================================================

/**
 * Get CSRF token for client-side use
 * Call this from a server component and pass to client
 */
export async function getCsrfToken(): Promise<string> {
  let token = getCsrfCookie();
  
  if (!token || !validateCsrfToken(token).valid) {
    token = await setCsrfCookie();
  }
  
  return token;
}

/**
 * Header configuration for fetch requests
 */
export function getCsrfHeaders(token: string): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: token,
  };
}
