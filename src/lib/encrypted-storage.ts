/**
 * Encrypted Storage Utility
 * Provides client-side encryption for sensitive cached data.
 * Uses Web Crypto API for encryption/decryption.
 */

// Key derivation parameters
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

/**
 * Derives an encryption key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM
 * Returns base64-encoded string: salt + iv + ciphertext
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const key = await deriveKey(password, salt);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts AES-GCM encrypted data
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  const decoder = new TextDecoder();
  
  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  );

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Generates a device-specific encryption key
 * Uses fingerprint-like data unique to this browser/device
 */
export function generateDeviceKey(): string {
  // Use navigator data + random stored component
  let storedPart = localStorage.getItem('_dk');
  if (!storedPart) {
    storedPart = crypto.getRandomValues(new Uint8Array(32))
      .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
    localStorage.setItem('_dk', storedPart);
  }

  // Combine with device characteristics (won't change on same device)
  const deviceInfo = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    storedPart,
  ].join('|');

  return deviceInfo;
}

// Type for cached student IDs
interface EncryptedCache {
  ids: string[];
  count: number;
  lastUpdated: string;
  cachedAt: string;
}

/**
 * Encrypted Student ID Cache
 * Stores student IDs with encryption to prevent casual extraction
 */
export const studentIdCache = {
  STORAGE_KEY: 'sid_cache_v1',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  async save(data: { ids: string[]; count: number; lastUpdated: string }): Promise<void> {
    try {
      const deviceKey = generateDeviceKey();
      const cacheData: EncryptedCache = {
        ...data,
        cachedAt: new Date().toISOString(),
      };
      
      const encrypted = await encrypt(JSON.stringify(cacheData), deviceKey);
      localStorage.setItem(this.STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to encrypt ID cache:', error);
      // Fall back to removing old cache
      localStorage.removeItem(this.STORAGE_KEY);
    }
  },

  async load(): Promise<EncryptedCache | null> {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_KEY);
      if (!encrypted) return null;

      const deviceKey = generateDeviceKey();
      const decrypted = await decrypt(encrypted, deviceKey);
      const data: EncryptedCache = JSON.parse(decrypted);

      // Check if cache is expired
      const cachedAt = new Date(data.cachedAt).getTime();
      if (Date.now() - cachedAt > this.CACHE_DURATION) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to decrypt ID cache:', error);
      localStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  },

  async has(studentId: string): Promise<boolean> {
    const cache = await this.load();
    if (!cache) return false;
    return cache.ids.includes(studentId);
  },

  clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  },
};

/**
 * Secure hash for validation without exposing IDs
 * Can be used for bloom filter-like checks
 */
export async function hashStudentId(id: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
