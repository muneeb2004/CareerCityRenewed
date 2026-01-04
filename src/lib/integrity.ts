/**
 * Data Integrity Utilities
 * OWASP A08:2021 - Software and Data Integrity Failures
 * 
 * Provides data integrity verification:
 * - Checksum generation and verification
 * - HMAC-based data signatures
 * - Request/Response integrity validation
 * - Anti-tampering for critical operations
 */

import crypto from 'crypto';
import { logDataIntegrityFailure, logSuspiciousActivity } from './security-logger';

// =============================================================================
// Types
// =============================================================================

export interface IntegrityPayload<T = unknown> {
  data: T;
  checksum: string;
  timestamp: number;
  version: string;
}

export interface SignedData<T = unknown> {
  data: T;
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface IntegrityResult {
  valid: boolean;
  error?: string;
  details?: {
    checksumMismatch?: boolean;
    expired?: boolean;
    invalidFormat?: boolean;
    replayAttempt?: boolean;
  };
}

// =============================================================================
// Configuration
// =============================================================================

const INTEGRITY_VERSION = '1.0';
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for requests
const NONCE_LENGTH = 16;

// Get signing key from environment
function getSigningKey(): string {
  const key = process.env.INTEGRITY_SECRET || process.env.HMAC_SECRET || process.env.JWT_SECRET;
  
  if (!key) {
    throw new Error('No signing key available for integrity checks');
  }
  
  return key;
}

// =============================================================================
// Nonce Tracking (for replay protection)
// =============================================================================

// In-memory nonce store (use Redis in production for distributed systems)
const usedNonces = new Map<string, number>();
const NONCE_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const NONCE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup of old nonces
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
      if (now - timestamp > NONCE_MAX_AGE) {
        usedNonces.delete(nonce);
      }
    }
  }, NONCE_CLEANUP_INTERVAL);
}

/**
 * Generate a unique nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(NONCE_LENGTH).toString('hex');
}

/**
 * Check if a nonce has been used (and mark it as used)
 */
export function checkAndUseNonce(nonce: string): boolean {
  if (usedNonces.has(nonce)) {
    return false; // Nonce already used - possible replay attack
  }
  
  usedNonces.set(nonce, Date.now());
  return true;
}

// =============================================================================
// Checksum Generation
// =============================================================================

/**
 * Generate SHA-256 checksum for any data
 */
export function generateChecksum(data: unknown): string {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, sortedReplacer);
  
  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex');
}

/**
 * Generate fast checksum (MD5 - NOT for security, only for quick validation)
 */
export function generateFastChecksum(data: unknown): string {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, sortedReplacer);
  
  return crypto
    .createHash('md5')
    .update(jsonString)
    .digest('hex');
}

/**
 * JSON replacer that sorts keys for consistent serialization
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as object)
      .sort()
      .reduce((sorted: Record<string, unknown>, key: string) => {
        sorted[key] = (value as Record<string, unknown>)[key];
        return sorted;
      }, {});
  }
  return value;
}

// =============================================================================
// Checksum Verification
// =============================================================================

/**
 * Verify data matches expected checksum
 */
export function verifyChecksum(data: unknown, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(data);
  return constantTimeEqual(actualChecksum, expectedChecksum);
}

/**
 * Constant-time string comparison
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}

// =============================================================================
// HMAC Signatures
// =============================================================================

/**
 * Sign data with HMAC-SHA256
 */
export function signData(data: unknown, secret?: string): string {
  const key = secret || getSigningKey();
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, sortedReplacer);
  
  return crypto
    .createHmac('sha256', key)
    .update(jsonString)
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifySignature(data: unknown, signature: string, secret?: string): boolean {
  const expectedSignature = signData(data, secret);
  return constantTimeEqual(signature, expectedSignature);
}

// =============================================================================
// Integrity Payload (for general data protection)
// =============================================================================

/**
 * Create an integrity-protected payload
 */
export function createIntegrityPayload<T>(data: T): IntegrityPayload<T> {
  const payload: Omit<IntegrityPayload<T>, 'checksum'> = {
    data,
    timestamp: Date.now(),
    version: INTEGRITY_VERSION,
  };
  
  const checksum = generateChecksum(payload);
  
  return {
    ...payload,
    checksum,
  };
}

/**
 * Verify an integrity-protected payload
 */
export function verifyIntegrityPayload<T>(
  payload: IntegrityPayload<T>,
  maxAgeMs: number = DEFAULT_EXPIRY_MS
): IntegrityResult {
  // Check structure
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      error: 'Invalid payload structure',
      details: { invalidFormat: true },
    };
  }
  
  const { data, checksum, timestamp, version } = payload;
  
  if (!data || !checksum || !timestamp || !version) {
    return {
      valid: false,
      error: 'Missing required fields',
      details: { invalidFormat: true },
    };
  }
  
  // Check version
  if (version !== INTEGRITY_VERSION) {
    return {
      valid: false,
      error: 'Version mismatch',
      details: { invalidFormat: true },
    };
  }
  
  // Check expiry
  const age = Date.now() - timestamp;
  if (age > maxAgeMs) {
    return {
      valid: false,
      error: 'Payload expired',
      details: { expired: true },
    };
  }
  
  // Verify checksum
  const expectedChecksum = generateChecksum({ data, timestamp, version });
  
  if (!constantTimeEqual(checksum, expectedChecksum)) {
    // Log potential tampering
    logDataIntegrityFailure('integrity_payload', `Checksum mismatch (age: ${age}ms, version: ${version})`);
    
    return {
      valid: false,
      error: 'Checksum verification failed',
      details: { checksumMismatch: true },
    };
  }
  
  return { valid: true };
}

// =============================================================================
// Signed Data (for secure transmission with replay protection)
// =============================================================================

/**
 * Create signed data with replay protection
 */
export function createSignedData<T>(data: T, secret?: string): SignedData<T> {
  const nonce = generateNonce();
  const timestamp = Date.now();
  
  const payload = { data, timestamp, nonce };
  const signature = signData(payload, secret);
  
  return {
    data,
    signature,
    timestamp,
    nonce,
  };
}

/**
 * Verify signed data with replay protection
 */
export function verifySignedData<T>(
  signedData: SignedData<T>,
  maxAgeMs: number = DEFAULT_EXPIRY_MS,
  secret?: string
): IntegrityResult {
  // Check structure
  if (!signedData || typeof signedData !== 'object') {
    return {
      valid: false,
      error: 'Invalid signed data structure',
      details: { invalidFormat: true },
    };
  }
  
  const { data, signature, timestamp, nonce } = signedData;
  
  if (data === undefined || !signature || !timestamp || !nonce) {
    return {
      valid: false,
      error: 'Missing required fields',
      details: { invalidFormat: true },
    };
  }
  
  // Check expiry
  const age = Date.now() - timestamp;
  if (age > maxAgeMs) {
    return {
      valid: false,
      error: 'Signed data expired',
      details: { expired: true },
    };
  }
  
  // Check for replay attack
  if (!checkAndUseNonce(nonce)) {
    logSuspiciousActivity('Potential replay attack detected', { nonce, age });
    
    return {
      valid: false,
      error: 'Duplicate nonce - possible replay attack',
      details: { replayAttempt: true },
    };
  }
  
  // Verify signature
  const payload = { data, timestamp, nonce };
  if (!verifySignature(payload, signature, secret)) {
    logDataIntegrityFailure('signed_data', `Signature verification failed (age: ${age}ms, nonce: ${nonce.slice(0, 8)}...)`);
    
    return {
      valid: false,
      error: 'Signature verification failed',
      details: { checksumMismatch: true },
    };
  }
  
  return { valid: true };
}

// =============================================================================
// Request Integrity (for critical form submissions)
// =============================================================================

export interface RequestIntegrityToken {
  token: string;
  timestamp: number;
  formId: string;
}

/**
 * Generate a request integrity token for a form
 */
export function generateRequestToken(formId: string): RequestIntegrityToken {
  const timestamp = Date.now();
  const nonce = generateNonce();
  
  const payload = { formId, timestamp, nonce };
  const signature = signData(payload);
  
  // Combine into a single token
  const token = Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64');
  
  return {
    token,
    timestamp,
    formId,
  };
}

/**
 * Verify a request integrity token
 */
export function verifyRequestToken(
  token: string,
  expectedFormId: string,
  maxAgeMs: number = DEFAULT_EXPIRY_MS
): IntegrityResult {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const { formId, timestamp, nonce, signature } = decoded;
    
    // Check form ID matches
    if (formId !== expectedFormId) {
      return {
        valid: false,
        error: 'Form ID mismatch',
        details: { invalidFormat: true },
      };
    }
    
    // Check expiry
    const age = Date.now() - timestamp;
    if (age > maxAgeMs) {
      return {
        valid: false,
        error: 'Token expired',
        details: { expired: true },
      };
    }
    
    // Check replay
    if (!checkAndUseNonce(nonce)) {
      logSuspiciousActivity('Request token replay attempt', { formId, nonce });
      
      return {
        valid: false,
        error: 'Token already used',
        details: { replayAttempt: true },
      };
    }
    
    // Verify signature
    const payload = { formId, timestamp, nonce };
    if (!verifySignature(payload, signature)) {
      logDataIntegrityFailure('request_token', `Invalid token signature for form: ${formId}`);
      
      return {
        valid: false,
        error: 'Invalid token signature',
        details: { checksumMismatch: true },
      };
    }
    
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Invalid token format',
      details: { invalidFormat: true },
    };
  }
}

// =============================================================================
// Data Fingerprinting
// =============================================================================

/**
 * Generate a fingerprint for a data object
 * Useful for detecting changes without storing full data
 */
export function generateFingerprint(data: unknown): string {
  return generateChecksum(data).slice(0, 16);
}

/**
 * Check if data has changed by comparing fingerprints
 */
export function hasDataChanged(data: unknown, previousFingerprint: string): boolean {
  const currentFingerprint = generateFingerprint(data);
  return currentFingerprint !== previousFingerprint;
}

// =============================================================================
// Audit Trail Integrity
// =============================================================================

export interface AuditEntry {
  id: string;
  action: string;
  userId?: string;
  data?: unknown;
  timestamp: number;
  previousHash?: string;
  hash: string;
}

/**
 * Create an audit entry with hash chain (blockchain-like integrity)
 */
export function createAuditEntry(
  action: string,
  data: unknown,
  userId?: string,
  previousHash?: string
): AuditEntry {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  
  // Create hash of entry content + previous hash (chain)
  const hashContent = {
    id,
    action,
    userId,
    data,
    timestamp,
    previousHash: previousHash || 'GENESIS',
  };
  
  const hash = generateChecksum(hashContent);
  
  return {
    id,
    action,
    userId,
    data,
    timestamp,
    previousHash,
    hash,
  };
}

/**
 * Verify an audit entry's integrity
 */
export function verifyAuditEntry(entry: AuditEntry): boolean {
  const hashContent = {
    id: entry.id,
    action: entry.action,
    userId: entry.userId,
    data: entry.data,
    timestamp: entry.timestamp,
    previousHash: entry.previousHash || 'GENESIS',
  };
  
  const expectedHash = generateChecksum(hashContent);
  return constantTimeEqual(entry.hash, expectedHash);
}

/**
 * Verify a chain of audit entries
 */
export function verifyAuditChain(entries: AuditEntry[]): {
  valid: boolean;
  brokenAt?: number;
} {
  if (entries.length === 0) {
    return { valid: true };
  }
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Verify individual entry
    if (!verifyAuditEntry(entry)) {
      return { valid: false, brokenAt: i };
    }
    
    // Verify chain link (except for first entry)
    if (i > 0) {
      const previousEntry = entries[i - 1];
      if (entry.previousHash !== previousEntry.hash) {
        return { valid: false, brokenAt: i };
      }
    }
  }
  
  return { valid: true };
}

// =============================================================================
// Helper Functions for Common Use Cases
// =============================================================================

/**
 * Quick integrity check for form data
 */
export async function validateFormIntegrity<T extends Record<string, unknown>>(
  formData: T,
  checksum: string,
  formId?: string,
  token?: string
): Promise<IntegrityResult> {
  // Verify data checksum
  if (!verifyChecksum(formData, checksum)) {
    return {
      valid: false,
      error: 'Form data integrity check failed',
      details: { checksumMismatch: true },
    };
  }
  
  // Verify request token if provided
  if (formId && token) {
    const tokenResult = verifyRequestToken(token, formId);
    if (!tokenResult.valid) {
      return tokenResult;
    }
  }
  
  return { valid: true };
}

/**
 * Create a secure package for transmitting sensitive data
 */
export function packageSecureData<T>(data: T, formId?: string): {
  payload: IntegrityPayload<T>;
  token?: string;
} {
  const payload = createIntegrityPayload(data);
  
  if (formId) {
    const { token } = generateRequestToken(formId);
    return { payload, token };
  }
  
  return { payload };
}

/**
 * Unpack and verify secure data
 */
export function unpackSecureData<T>(
  payload: IntegrityPayload<T>,
  token?: string,
  formId?: string,
  maxAgeMs?: number
): { valid: boolean; data?: T; error?: string } {
  // Verify payload
  const payloadResult = verifyIntegrityPayload(payload, maxAgeMs);
  if (!payloadResult.valid) {
    return { valid: false, error: payloadResult.error };
  }
  
  // Verify token if provided
  if (token && formId) {
    const tokenResult = verifyRequestToken(token, formId, maxAgeMs);
    if (!tokenResult.valid) {
      return { valid: false, error: tokenResult.error };
    }
  }
  
  return { valid: true, data: payload.data };
}
