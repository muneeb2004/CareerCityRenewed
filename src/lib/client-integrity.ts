/**
 * Client-side Integrity Utilities
 * OWASP A08:2021 - Software and Data Integrity Failures
 * 
 * Provides client-safe integrity functions using SubtleCrypto API
 * for generating checksums before submitting data to the server.
 */

/**
 * Generate SHA-256 checksum for data (browser-compatible)
 */
export async function generateClientChecksum(data: unknown): Promise<string> {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, sortedReplacer);
  
  // Use SubtleCrypto API available in browsers
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Generate fast fingerprint for data (truncated hash)
 */
export async function generateFingerprint(data: unknown): Promise<string> {
  const hash = await generateClientChecksum(data);
  return hash.slice(0, 16);
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

/**
 * Create integrity-protected payload for submission
 */
export async function createIntegrityPayload<T>(data: T): Promise<{
  data: T;
  checksum: string;
  timestamp: number;
}> {
  const timestamp = Date.now();
  const payloadForHash = { data, timestamp };
  const checksum = await generateClientChecksum(payloadForHash);
  
  return {
    data,
    checksum,
    timestamp,
  };
}

/**
 * Hook for creating checksums in React components
 */
export function useIntegrity() {
  return {
    generateChecksum: generateClientChecksum,
    generateFingerprint,
    createPayload: createIntegrityPayload,
  };
}
