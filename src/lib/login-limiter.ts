/**
 * Login Attempt Limiter
 * OWASP A07:2021 - Identification and Authentication Failures
 * 
 * Provides protection against brute force attacks by:
 * - Tracking failed login attempts per identifier (username/IP)
 * - Implementing progressive lockout after multiple failures
 * - Automatically clearing attempts after successful login
 * - Supporting both IP-based and username-based limiting
 */

import { logBruteForceAttempt, logSuspiciousActivity, getClientIp } from './security-logger';

// =============================================================================
// Types & Configuration
// =============================================================================

interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

interface LoginAttemptResult {
  allowed: boolean;
  remaining: number;
  lockedUntil?: number;
  lockDurationMinutes?: number;
  message?: string;
}

// Configuration - can be overridden via environment variables
const CONFIG = {
  // Maximum failed attempts before lockout
  maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
  
  // Initial lockout duration in minutes
  initialLockMinutes: parseInt(process.env.LOGIN_INITIAL_LOCK_MINUTES || '5', 10),
  
  // Maximum lockout duration in minutes (for progressive lockout)
  maxLockMinutes: parseInt(process.env.LOGIN_MAX_LOCK_MINUTES || '60', 10),
  
  // Time window for counting attempts (in milliseconds)
  attemptWindowMs: parseInt(process.env.LOGIN_ATTEMPT_WINDOW_MS || '900000', 10), // 15 minutes
  
  // Enable progressive lockout (doubles each time)
  progressiveLockout: process.env.LOGIN_PROGRESSIVE_LOCKOUT !== 'false',
  
  // Maximum number of records to keep in memory
  maxRecords: 10000,
  
  // Cleanup interval in milliseconds
  cleanupIntervalMs: 60000, // 1 minute
};

// =============================================================================
// In-Memory Store (Consider Redis for production clusters)
// =============================================================================

// Separate stores for username and IP-based limiting
const usernameAttempts = new Map<string, LoginAttemptRecord>();
const ipAttempts = new Map<string, LoginAttemptRecord>();

// Track consecutive lockouts for progressive lockout
const lockoutHistory = new Map<string, number>();

// Last cleanup timestamp
let lastCleanup = Date.now();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Clean up expired records to prevent memory bloat
 */
function cleanupExpiredRecords(): void {
  const now = Date.now();
  
  // Only cleanup every minute
  if (now - lastCleanup < CONFIG.cleanupIntervalMs) {
    return;
  }
  
  lastCleanup = now;
  
  // Clean username attempts
  for (const [key, record] of usernameAttempts.entries()) {
    if (now > record.lockedUntil && now - record.lastAttemptAt > CONFIG.attemptWindowMs) {
      usernameAttempts.delete(key);
      lockoutHistory.delete(`user:${key}`);
    }
  }
  
  // Clean IP attempts
  for (const [key, record] of ipAttempts.entries()) {
    if (now > record.lockedUntil && now - record.lastAttemptAt > CONFIG.attemptWindowMs) {
      ipAttempts.delete(key);
      lockoutHistory.delete(`ip:${key}`);
    }
  }
  
  // Force cleanup if we have too many records
  if (usernameAttempts.size > CONFIG.maxRecords) {
    const sortedEntries = [...usernameAttempts.entries()]
      .sort((a, b) => a[1].lastAttemptAt - b[1].lastAttemptAt);
    
    // Remove oldest 20%
    const toRemove = Math.floor(sortedEntries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      usernameAttempts.delete(sortedEntries[i][0]);
    }
  }
  
  if (ipAttempts.size > CONFIG.maxRecords) {
    const sortedEntries = [...ipAttempts.entries()]
      .sort((a, b) => a[1].lastAttemptAt - b[1].lastAttemptAt);
    
    const toRemove = Math.floor(sortedEntries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      ipAttempts.delete(sortedEntries[i][0]);
    }
  }
}

/**
 * Calculate lockout duration based on consecutive lockouts
 */
function calculateLockDuration(identifier: string, type: 'user' | 'ip'): number {
  const key = `${type}:${identifier}`;
  const consecutiveLockouts = lockoutHistory.get(key) || 0;
  
  if (!CONFIG.progressiveLockout) {
    return CONFIG.initialLockMinutes * 60 * 1000;
  }
  
  // Double the lockout duration for each consecutive lockout
  const multiplier = Math.pow(2, consecutiveLockouts);
  const durationMinutes = Math.min(
    CONFIG.initialLockMinutes * multiplier,
    CONFIG.maxLockMinutes
  );
  
  return durationMinutes * 60 * 1000;
}

/**
 * Check attempts against a specific store
 */
function checkAttemptsInStore(
  store: Map<string, LoginAttemptRecord>,
  identifier: string,
  type: 'user' | 'ip'
): LoginAttemptResult {
  cleanupExpiredRecords();
  
  const now = Date.now();
  const record = store.get(identifier);
  
  // No previous attempts or window expired
  if (!record || now - record.firstAttemptAt > CONFIG.attemptWindowMs) {
    // If there was a previous record with lockout, it's now expired
    if (record && now > record.lockedUntil) {
      // Don't clear lockout history - keep it for progressive lockout
    }
    return { 
      allowed: true, 
      remaining: CONFIG.maxAttempts 
    };
  }
  
  // Currently locked out
  if (now < record.lockedUntil) {
    const remainingLockMs = record.lockedUntil - now;
    const remainingLockMinutes = Math.ceil(remainingLockMs / 60000);
    
    return {
      allowed: false,
      remaining: 0,
      lockedUntil: record.lockedUntil,
      lockDurationMinutes: remainingLockMinutes,
      message: `Too many failed attempts. Please try again in ${remainingLockMinutes} minute${remainingLockMinutes !== 1 ? 's' : ''}.`,
    };
  }
  
  // Check if max attempts reached
  if (record.count >= CONFIG.maxAttempts) {
    // Apply new lockout
    const lockDuration = calculateLockDuration(identifier, type);
    const lockedUntil = now + lockDuration;
    const lockDurationMinutes = Math.ceil(lockDuration / 60000);
    
    // Update lockout history for progressive lockout
    const historyKey = `${type}:${identifier}`;
    lockoutHistory.set(historyKey, (lockoutHistory.get(historyKey) || 0) + 1);
    
    // Update record
    store.set(identifier, {
      ...record,
      lockedUntil,
      lastAttemptAt: now,
    });
    
    return {
      allowed: false,
      remaining: 0,
      lockedUntil,
      lockDurationMinutes,
      message: `Too many failed attempts. Please try again in ${lockDurationMinutes} minute${lockDurationMinutes !== 1 ? 's' : ''}.`,
    };
  }
  
  // Still have attempts remaining
  return {
    allowed: true,
    remaining: CONFIG.maxAttempts - record.count,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if a login attempt is allowed for a given username
 */
export async function checkLoginAttempts(username: string): Promise<LoginAttemptResult> {
  const normalizedUsername = username.toLowerCase().trim();
  return checkAttemptsInStore(usernameAttempts, normalizedUsername, 'user');
}

/**
 * Check if a login attempt is allowed for a given IP address
 */
export async function checkIpAttempts(ip: string): Promise<LoginAttemptResult> {
  return checkAttemptsInStore(ipAttempts, ip, 'ip');
}

/**
 * Check both username and IP - returns the more restrictive result
 */
export async function checkLoginAllowed(
  username: string,
  ip?: string
): Promise<LoginAttemptResult & { blockedBy?: 'username' | 'ip' | 'both' }> {
  const clientIp = ip || await getClientIp();
  
  const usernameResult = await checkLoginAttempts(username);
  const ipResult = await checkIpAttempts(clientIp);
  
  // Both blocked
  if (!usernameResult.allowed && !ipResult.allowed) {
    return {
      ...usernameResult,
      blockedBy: 'both',
    };
  }
  
  // Username blocked
  if (!usernameResult.allowed) {
    return {
      ...usernameResult,
      blockedBy: 'username',
    };
  }
  
  // IP blocked
  if (!ipResult.allowed) {
    return {
      ...ipResult,
      blockedBy: 'ip',
    };
  }
  
  // Both allowed - return the lower remaining count
  return {
    allowed: true,
    remaining: Math.min(usernameResult.remaining, ipResult.remaining),
  };
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  username: string,
  ip?: string
): Promise<void> {
  const now = Date.now();
  const normalizedUsername = username.toLowerCase().trim();
  const clientIp = ip || await getClientIp();
  
  // Update username attempts
  const userRecord = usernameAttempts.get(normalizedUsername);
  if (!userRecord || now - userRecord.firstAttemptAt > CONFIG.attemptWindowMs) {
    // Start new window
    usernameAttempts.set(normalizedUsername, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
      lastAttemptAt: now,
    });
  } else {
    // Increment existing
    usernameAttempts.set(normalizedUsername, {
      ...userRecord,
      count: userRecord.count + 1,
      lastAttemptAt: now,
    });
  }
  
  // Update IP attempts
  const ipRecord = ipAttempts.get(clientIp);
  if (!ipRecord || now - ipRecord.firstAttemptAt > CONFIG.attemptWindowMs) {
    ipAttempts.set(clientIp, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
      lastAttemptAt: now,
    });
  } else {
    ipAttempts.set(clientIp, {
      ...ipRecord,
      count: ipRecord.count + 1,
      lastAttemptAt: now,
    });
  }
  
  // Check for brute force patterns
  const newUserRecord = usernameAttempts.get(normalizedUsername)!;
  const newIpRecord = ipAttempts.get(clientIp)!;
  
  // Log potential brute force if hitting limits
  if (newUserRecord.count === CONFIG.maxAttempts) {
    await logBruteForceAttempt(`username:${normalizedUsername}`, newUserRecord.count);
  }
  
  if (newIpRecord.count === CONFIG.maxAttempts) {
    await logBruteForceAttempt(`ip:${clientIp}`, newIpRecord.count);
  }
  
  // Log suspicious activity if multiple accounts from same IP
  if (newIpRecord.count >= CONFIG.maxAttempts * 2) {
    await logSuspiciousActivity(
      'Multiple login failures from single IP - possible credential stuffing',
      { ip: clientIp, attemptCount: newIpRecord.count }
    );
  }
}

/**
 * Clear login attempts after successful login
 */
export async function clearLoginAttempts(
  username: string,
  ip?: string
): Promise<void> {
  const normalizedUsername = username.toLowerCase().trim();
  const clientIp = ip || await getClientIp();
  
  // Clear username attempts but keep lockout history for progressive lockout
  usernameAttempts.delete(normalizedUsername);
  
  // For IP, only clear the current record, not the history
  // This prevents an attacker from using one valid account to reset IP limits
  const ipRecord = ipAttempts.get(clientIp);
  if (ipRecord) {
    // Reduce count but don't fully clear
    ipAttempts.set(clientIp, {
      ...ipRecord,
      count: Math.max(0, ipRecord.count - 1),
    });
  }
  
  // Clear lockout history for successful user
  lockoutHistory.delete(`user:${normalizedUsername}`);
}

/**
 * Get current attempt status (for UI feedback)
 */
export async function getAttemptStatus(
  username: string,
  ip?: string
): Promise<{
  usernameAttempts: number;
  ipAttempts: number;
  isLocked: boolean;
  lockExpires?: number;
}> {
  const normalizedUsername = username.toLowerCase().trim();
  const clientIp = ip || await getClientIp();
  
  const userRecord = usernameAttempts.get(normalizedUsername);
  const ipRecord = ipAttempts.get(clientIp);
  const now = Date.now();
  
  const userLocked = userRecord ? now < userRecord.lockedUntil : false;
  const ipLocked = ipRecord ? now < ipRecord.lockedUntil : false;
  
  return {
    usernameAttempts: userRecord?.count || 0,
    ipAttempts: ipRecord?.count || 0,
    isLocked: userLocked || ipLocked,
    lockExpires: userLocked 
      ? userRecord?.lockedUntil 
      : ipLocked 
        ? ipRecord?.lockedUntil 
        : undefined,
  };
}

/**
 * Admin function to manually unlock an account
 */
export async function adminUnlockAccount(username: string): Promise<void> {
  const normalizedUsername = username.toLowerCase().trim();
  usernameAttempts.delete(normalizedUsername);
  lockoutHistory.delete(`user:${normalizedUsername}`);
}

/**
 * Admin function to manually unlock an IP
 */
export async function adminUnlockIp(ip: string): Promise<void> {
  ipAttempts.delete(ip);
  lockoutHistory.delete(`ip:${ip}`);
}

/**
 * Get statistics about current lockouts (for monitoring)
 */
export function getLockoutStats(): {
  lockedUsernames: number;
  lockedIps: number;
  totalUsernameRecords: number;
  totalIpRecords: number;
} {
  const now = Date.now();
  
  let lockedUsernames = 0;
  for (const record of usernameAttempts.values()) {
    if (now < record.lockedUntil) {
      lockedUsernames++;
    }
  }
  
  let lockedIps = 0;
  for (const record of ipAttempts.values()) {
    if (now < record.lockedUntil) {
      lockedIps++;
    }
  }
  
  return {
    lockedUsernames,
    lockedIps,
    totalUsernameRecords: usernameAttempts.size,
    totalIpRecords: ipAttempts.size,
  };
}
