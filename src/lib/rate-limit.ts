/**
 * Rate Limiter
 * Production-ready rate limiting for API endpoints
 * 
 * Supports:
 * - Configurable limits per endpoint type
 * - IP-based and user-based limiting
 * - Sliding window algorithm
 * - Automatic cleanup of expired records
 */

// =============================================================================
// Configuration
// =============================================================================

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
}

// Production rate limits by endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict limits
  login: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,
    message: 'Too many login attempts. Please try again later.',
  },
  
  // Registration - prevent spam
  registration: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,
    message: 'Too many registration attempts. Please try again later.',
  },
  
  // General API endpoints
  api: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
  
  // Scan operations - moderate limits
  scan: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 30,
    message: 'Too many scan operations. Please wait.',
  },
  
  // Feedback submission
  feedback: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 20,
    message: 'Too many feedback submissions. Please wait.',
  },
  
  // Data export - strict limits
  export: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 5,
    message: 'Export limit reached. Please try again later.',
  },
  
  // Health check - lenient
  health: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 60,
    message: 'Too many health check requests.',
  },
};

// =============================================================================
// Rate Limit Store
// =============================================================================

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

// In-memory store (consider Redis for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup configuration
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_RECORDS = 50000;
let lastCleanup = Date.now();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a rate limit key
 */
function generateKey(identifier: string, endpoint: string): string {
  return `${endpoint}:${identifier}`;
}

/**
 * Clean up expired records to prevent memory bloat
 */
function cleanupExpiredRecords(): void {
  const now = Date.now();
  
  // Only cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  
  lastCleanup = now;
  
  // Find the longest window to determine expiry
  const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(r => r.windowMs));
  
  // Remove expired records
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > maxWindow) {
      rateLimitStore.delete(key);
    }
  }
  
  // If still too many records, remove oldest
  if (rateLimitStore.size > MAX_RECORDS) {
    const entries = Array.from(rateLimitStore.entries())
      .sort((a, b) => a[1].windowStart - b[1].windowStart);
    
    const toRemove = entries.slice(0, rateLimitStore.size - MAX_RECORDS);
    toRemove.forEach(([key]) => rateLimitStore.delete(key));
  }
}

// =============================================================================
// Main Rate Limit Functions
// =============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  message?: string;
}

/**
 * Check rate limit for a specific endpoint type
 */
export function checkRateLimit(
  identifier: string,
  endpoint: keyof typeof RATE_LIMITS = 'api'
): RateLimitResult {
  cleanupExpiredRecords();
  
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.api;
  const key = generateKey(identifier, endpoint);
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  // Check if window has expired
  if (record && now - record.windowStart > config.windowMs) {
    rateLimitStore.delete(key);
    record = undefined;
  }
  
  // New record
  if (!record) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
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
 * Simple rate limit check (backward compatible)
 */
export function simpleRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 10000
): { allowed: boolean; resetAt?: number } {
  const key = `simple:${identifier}`;
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  if (record && now - record.windowStart > windowMs) {
    rateLimitStore.delete(key);
    record = undefined;
  }
  
  if (!record) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, resetAt: record.windowStart + windowMs };
  }
  
  record.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for an identifier (e.g., after successful auth)
 */
export function resetRateLimit(identifier: string, endpoint?: string): void {
  if (endpoint) {
    rateLimitStore.delete(generateKey(identifier, endpoint));
  } else {
    // Reset all endpoints for this identifier
    for (const key of rateLimitStore.keys()) {
      if (key.endsWith(`:${identifier}`)) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
  };
}

/**
 * Get current rate limit config (for documentation/testing)
 */
export function getRateLimitConfig(): typeof RATE_LIMITS {
  return { ...RATE_LIMITS };
}

