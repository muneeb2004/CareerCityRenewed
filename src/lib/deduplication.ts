// In-memory request deduplication
const recentRequests = new Map<string, number>();
const DEDUP_WINDOW = 5000; // 5 seconds

/**
 * Checks if a request is a duplicate based on a unique key.
 * Automatically cleans up old entries to prevent memory leaks.
 */
export function isDuplicate(key: string): boolean {
  const lastRequest = recentRequests.get(key);
  const now = Date.now();
  
  if (lastRequest && now - lastRequest < DEDUP_WINDOW) {
    return true;
  }
  
  recentRequests.set(key, now);
  
  // Cleanup old entries if the map grows too large
  if (recentRequests.size > 1000) {
    for (const [k, timestamp] of recentRequests) {
      if (now - timestamp > DEDUP_WINDOW) {
        recentRequests.delete(k);
      }
    }
  }
  
  return false;
}
