/**
 * Input Sanitization Utilities
 * 
 * Provides defense-in-depth sanitization for user inputs.
 * Used in addition to Zod validation for extra security.
 */

// ============================================
// HTML Sanitization
// ============================================

/**
 * Sanitize HTML to prevent XSS attacks
 * Escapes special HTML characters
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Strip all HTML tags from input
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input.replace(/<[^>]*>/g, '');
}

// ============================================
// ID Sanitization
// ============================================

/**
 * Sanitize an ID field - only allow alphanumeric, underscore, hyphen
 */
export function sanitizeId(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Sanitize a slug - lowercase, hyphens only
 */
export function sanitizeSlug(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// ============================================
// Text Sanitization
// ============================================

/**
 * Sanitize general text input
 * Removes control characters and normalizes whitespace
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize multi-line text (preserves newlines)
 */
export function sanitizeMultilineText(input: string, maxLength: number = 5000): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove control characters (preserve newlines)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize multiple newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    // Normalize spaces (not newlines)
    .replace(/[^\S\n]+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize name (letters, spaces, hyphens, apostrophes)
 */
export function sanitizeName(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[^a-zA-Z\s\-'.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// ============================================
// Number Sanitization
// ============================================

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(
  input: unknown,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  return Math.min(Math.max(num, min), max);
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(
  input: unknown,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = sanitizeNumber(input, min, max);
  return num !== null ? Math.floor(num) : null;
}

// ============================================
// MongoDB/NoSQL Injection Prevention
// ============================================

/**
 * Check if value contains MongoDB operators (potential injection)
 */
export function containsMongoOperator(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.startsWith('$');
  }
  
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return keys.some(k => k.startsWith('$'));
  }
  
  return false;
}

/**
 * Sanitize a value for safe MongoDB queries
 * Throws if potential injection detected
 */
export function sanitizeForMongo<T>(value: T, fieldName: string = 'value'): T {
  if (containsMongoOperator(value)) {
    throw new Error(`Invalid ${fieldName}: potential injection detected`);
  }
  
  // Recursively check nested objects
  if (typeof value === 'object' && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      sanitizeForMongo(val, `${fieldName}.${key}`);
    }
  }
  
  return value;
}

/**
 * Create a safe MongoDB query condition
 * Always uses $eq operator to prevent injection
 */
export function safeEquals<T>(value: T): { $eq: T } {
  if (containsMongoOperator(value)) {
    throw new Error('Invalid value: potential injection detected');
  }
  return { $eq: value };
}

// ============================================
// URL Sanitization
// ============================================

/**
 * Sanitize and validate URL
 */
export function sanitizeUrl(input: string): string | null {
  if (typeof input !== 'string') return null;
  
  try {
    const url = new URL(input);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    
    // Return the sanitized URL
    return url.toString();
  } catch {
    return null;
  }
}

// ============================================
// Email Sanitization
// ============================================

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .toLowerCase()
    .trim()
    // Remove any characters not valid in emails
    .replace(/[^a-z0-9@._+-]/g, '')
    .substring(0, 255);
}

// ============================================
// Object Sanitization
// ============================================

/**
 * Deep sanitize an object's string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    stripHtml?: boolean;
    maxStringLength?: number;
  } = {}
): T {
  const { stripHtml: shouldStripHtml = false, maxStringLength = 10000 } = options;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check for injection in keys
    if (key.startsWith('$')) {
      continue; // Skip potentially malicious keys
    }
    
    if (typeof value === 'string') {
      let sanitizedValue = shouldStripHtml ? stripHtml(value) : sanitizeHtml(value);
      sanitizedValue = sanitizedValue.substring(0, maxStringLength);
      sanitized[key] = sanitizedValue;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' 
          ? (shouldStripHtml ? stripHtml(item) : sanitizeHtml(item)).substring(0, maxStringLength)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// ============================================
// Combined Validation & Sanitization
// ============================================

/**
 * Sanitize feedback responses
 */
export function sanitizeFeedbackResponses(
  responses: Record<string, unknown>
): Record<string, string | number | string[]> {
  const sanitized: Record<string, string | number | string[]> = {};
  
  for (const [key, value] of Object.entries(responses)) {
    // Sanitize key
    const safeKey = sanitizeId(key);
    if (!safeKey || safeKey.length > 100) continue;
    
    // Sanitize value based on type
    if (typeof value === 'string') {
      sanitized[safeKey] = sanitizeText(value, 1000);
    } else if (typeof value === 'number') {
      const num = sanitizeNumber(value, 1, 10);
      if (num !== null) sanitized[safeKey] = num;
    } else if (Array.isArray(value)) {
      sanitized[safeKey] = value
        .filter(v => typeof v === 'string')
        .map(v => sanitizeText(v, 200))
        .slice(0, 10);
    }
  }
  
  return sanitized;
}
