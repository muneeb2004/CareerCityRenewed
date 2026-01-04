/**
 * Cryptographic Utilities
 * OWASP A02:2021 - Cryptographic Failures
 * 
 * Provides secure encryption, decryption, and hashing utilities:
 * - AES-256-GCM authenticated encryption
 * - SHA-256/SHA-512 hashing
 * - PBKDF2 key derivation
 * - Secure random generation
 * - Constant-time comparison
 */

import crypto from 'crypto';

// =============================================================================
// Configuration
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return Buffer.from(keyHex, 'hex');
}

// =============================================================================
// Encryption / Decryption
// =============================================================================

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Expects format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt an object (serializes to JSON first)
 */
export function encryptObject<T>(data: T): string {
  const jsonString = JSON.stringify(data);
  return encrypt(jsonString);
}

/**
 * Decrypt to an object (parses JSON after decryption)
 */
export function decryptObject<T>(encryptedData: string): T {
  const jsonString = decrypt(encryptedData);
  return JSON.parse(jsonString) as T;
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Create SHA-256 hash of data
 * Non-reversible - use for identifiers, checksums, etc.
 */
export function hashSHA256(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Create SHA-512 hash of data
 * Stronger hash for sensitive data
 */
export function hashSHA512(data: string): string {
  return crypto
    .createHash('sha512')
    .update(data)
    .digest('hex');
}

/**
 * Create HMAC-SHA256 of data with a secret
 * Use for verifiable signatures
 */
export function hmacSHA256(data: string, secret?: string): string {
  const key = secret || process.env.HMAC_SECRET || process.env.JWT_SECRET;
  
  if (!key) {
    throw new Error('No HMAC secret available');
  }
  
  return crypto
    .createHmac('sha256', key)
    .update(data)
    .digest('hex');
}

/**
 * Verify HMAC-SHA256 signature (constant-time comparison)
 */
export function verifyHmac(data: string, signature: string, secret?: string): boolean {
  const expectedSignature = hmacSHA256(data, secret);
  return constantTimeEqual(signature, expectedSignature);
}

// =============================================================================
// Password Hashing
// =============================================================================

/**
 * Hash a password using PBKDF2
 * Returns format: salt:hash (both hex encoded)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  const [saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  
  const actualHash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(
  password: string,
  salt: Buffer | string,
  iterations: number = PBKDF2_ITERATIONS,
  keyLength: number = KEY_LENGTH
): Buffer {
  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'hex') : salt;
  
  return crypto.pbkdf2Sync(
    password,
    saltBuffer,
    iterations,
    keyLength,
    'sha512'
  );
}

/**
 * Generate a new random salt
 */
export function generateSalt(length: number = SALT_LENGTH): string {
  return crypto.randomBytes(length).toString('hex');
}

// =============================================================================
// Random Generation
// =============================================================================

/**
 * Generate cryptographically secure random bytes
 */
export function randomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generate a random hex string
 */
export function randomHex(byteLength: number): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Generate a random base64 string (URL-safe)
 */
export function randomBase64(byteLength: number): string {
  return crypto.randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random UUID v4
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random token suitable for URLs
 */
export function generateToken(length: number = 32): string {
  return randomBase64(length);
}

/**
 * Generate a secure verification code (numeric)
 */
export function generateVerificationCode(length: number = 6): string {
  const max = Math.pow(10, length);
  const randomNum = crypto.randomInt(0, max);
  return randomNum.toString().padStart(length, '0');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Mask sensitive data for logging/display
 * Shows first and last few characters only
 */
export function maskSensitive(
  data: string,
  showFirst: number = 2,
  showLast: number = 2,
  maskChar: string = '*'
): string {
  if (data.length <= showFirst + showLast) {
    return maskChar.repeat(data.length);
  }
  
  const first = data.slice(0, showFirst);
  const last = data.slice(-showLast);
  const maskLength = data.length - showFirst - showLast;
  
  return `${first}${maskChar.repeat(maskLength)}${last}`;
}

/**
 * Securely compare two strings (constant-time)
 */
export function secureCompare(a: string, b: string): boolean {
  return constantTimeEqual(a, b);
}

/**
 * Hash data for use as a cache key or identifier
 * Shorter than full SHA-256 for convenience
 */
export function hashForKey(data: string, length: number = 16): string {
  return hashSHA256(data).slice(0, length);
}

// =============================================================================
// Encryption with Custom Key
// =============================================================================

/**
 * Encrypt with a provided key (not from environment)
 * Useful for per-user or per-record encryption
 */
export function encryptWithKey(plaintext: string, keyHex: string): string {
  if (keyHex.length !== 64) {
    throw new Error('Key must be 64 hex characters (32 bytes)');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt with a provided key (not from environment)
 */
export function decryptWithKey(encryptedData: string, keyHex: string): string {
  if (keyHex.length !== 64) {
    throw new Error('Key must be 64 hex characters (32 bytes)');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  const parts = encryptedData.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// =============================================================================
// Data Obfuscation (for non-sensitive display purposes)
// =============================================================================

/**
 * Obfuscate an email address for display
 * john.doe@example.com -> j***e@e*****e.com
 */
export function obfuscateEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  
  const obfuscatedLocal = local.length <= 2 
    ? '*'.repeat(local.length)
    : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;
  
  const domainParts = domain.split('.');
  const obfuscatedDomain = domainParts.map(part => 
    part.length <= 2 
      ? '*'.repeat(part.length)
      : `${part[0]}${'*'.repeat(part.length - 2)}${part[part.length - 1]}`
  ).join('.');
  
  return `${obfuscatedLocal}@${obfuscatedDomain}`;
}

/**
 * Obfuscate a student ID for display
 * STU_ABC12345 -> STU_***12345
 */
export function obfuscateStudentId(studentId: string): string {
  if (studentId.length <= 8) return '*'.repeat(studentId.length);
  
  const prefix = studentId.slice(0, 4);
  const suffix = studentId.slice(-5);
  const middleLength = studentId.length - 9;
  
  return `${prefix}${'*'.repeat(middleLength)}${suffix}`;
}

// =============================================================================
// Type Guards and Validators
// =============================================================================

/**
 * Check if a string is valid hex
 */
export function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str);
}

/**
 * Check if a string appears to be encrypted data
 */
export function isEncryptedFormat(str: string): boolean {
  const parts = str.split(':');
  if (parts.length !== 3) return false;
  
  const [iv, authTag, ciphertext] = parts;
  
  return (
    iv.length === IV_LENGTH * 2 &&
    authTag.length === AUTH_TAG_LENGTH * 2 &&
    ciphertext.length > 0 &&
    isValidHex(iv) &&
    isValidHex(authTag) &&
    isValidHex(ciphertext)
  );
}
