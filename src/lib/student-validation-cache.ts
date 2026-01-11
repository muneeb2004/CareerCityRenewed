/**
 * Student ID Validation Hook and Cache
 * 
 * Provides offline-capable student ID validation with:
 * - Encrypted local caching of student IDs
 * - Memory cache for fast lookups
 * - Background sync with server
 * - Security: IDs are encrypted at rest using device-specific key
 */

import { studentIdCache } from '@/lib/encrypted-storage';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for fast lookups (never persisted to disk in plaintext)
let memoryCache: Set<string> | null = null;
let memoryCacheExpiry: number = 0;

/**
 * Fetch student IDs from the server
 */
export async function fetchStudentIds(): Promise<string[]> {
  try {
    const response = await fetch('/api/students/ids', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch student IDs: ${response.status}`);
    }

    const data = await response.json();
    return data.ids || [];
  } catch (error) {
    console.error('Error fetching student IDs:', error);
    throw error;
  }
}

/**
 * Load student IDs into cache (encrypted localStorage + memory)
 */
export async function loadStudentIdsCache(): Promise<Set<string>> {
  // Check memory cache first (fast path)
  const now = Date.now();
  if (memoryCache && memoryCacheExpiry > now) {
    return memoryCache;
  }

  // Check encrypted localStorage cache
  try {
    const cachedData = await studentIdCache.load();
    
    if (cachedData) {
      memoryCache = new Set(cachedData.ids);
      memoryCacheExpiry = now + CACHE_DURATION_MS;
      return memoryCache;
    }
  } catch (e) {
    console.warn('Failed to read from encrypted cache:', e);
  }

  // Fetch from server and update cache
  try {
    const ids = await fetchStudentIds();
    const newExpiry = now + CACHE_DURATION_MS;
    
    // Update memory cache
    memoryCache = new Set(ids);
    memoryCacheExpiry = newExpiry;
    
    // Update encrypted localStorage cache
    try {
      await studentIdCache.save({
        ids,
        count: ids.length,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to write to encrypted cache:', e);
    }
    
    return memoryCache;
  } catch (error) {
    // If fetch fails, try to use stale encrypted cache
    try {
      // Force reload from encrypted storage even if expired
      const cachedData = await studentIdCache.load();
      if (cachedData) {
        memoryCache = new Set(cachedData.ids);
        memoryCacheExpiry = now + 60000; // Use stale cache for 1 minute
        console.warn('Using stale student IDs cache');
        return memoryCache;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Return empty set if all else fails
    return new Set();
  }
}

/**
 * Extract student ID from combined format
 * "xx1234" → "1234", "xx12345" → "12345"
 */
export function extractStudentIdClient(combinedId: string | null | undefined): string | null {
  if (!combinedId || typeof combinedId !== 'string') {
    return null;
  }
  
  const trimmed = combinedId.trim();
  
  // Must have at least 2 prefix chars + at least 4 digits
  if (trimmed.length < 6) {
    return null;
  }
  
  // Extract everything after the first 2 characters
  const extracted = trimmed.substring(2);
  
  // Validate that extracted portion is numeric
  if (!/^\d+$/.test(extracted)) {
    return null;
  }
  
  // Must be 4 or 5 digits
  if (extracted.length < 4 || extracted.length > 5) {
    return null;
  }
  
  return extracted;
}

/**
 * Validate a student ID against the cache
 * @param combinedId - Full combined ID (e.g., "xx1234")
 * @returns true if valid
 */
export async function validateStudentIdCached(combinedId: string): Promise<boolean> {
  const extractedId = extractStudentIdClient(combinedId);
  if (!extractedId) {
    return false;
  }
  
  const cache = await loadStudentIdsCache();
  return cache.has(extractedId);
}

/**
 * Synchronously validate against memory cache (for UI responsiveness)
 * Returns null if cache not loaded
 */
export function validateStudentIdSync(combinedId: string): boolean | null {
  const extractedId = extractStudentIdClient(combinedId);
  if (!extractedId) {
    return false;
  }
  
  if (!memoryCache) {
    return null; // Cache not loaded
  }
  
  return memoryCache.has(extractedId);
}

/**
 * Force refresh the cache
 */
export async function refreshStudentIdsCache(): Promise<void> {
  memoryCache = null;
  memoryCacheExpiry = 0;
  
  // Clear encrypted cache
  studentIdCache.clear();
  
  await loadStudentIdsCache();
}

/**
 * Clear the cache (for logout)
 */
export function clearStudentIdsCache(): void {
  memoryCache = null;
  memoryCacheExpiry = 0;
  
  // Clear encrypted cache
  studentIdCache.clear();
}
