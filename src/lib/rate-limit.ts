// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 10000) {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  // Clean up if expired
  if (record && now > record.resetAt) {
    rateLimitMap.delete(identifier);
  }

  if (!record) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true };
}
