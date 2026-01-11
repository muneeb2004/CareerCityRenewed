/**
 * Student ID Utility Functions
 * 
 * Handles extraction and validation of student IDs.
 * 
 * ID Format:
 * - CSV contains variable-length IDs: 4 digits ("1234") for older batches, 5 digits ("12345") for newer
 * - System uses combined IDs with prefix: "xx1234" or "xx12345" (2-letter prefix + 4-5 digits)
 * - 5-digit IDs always start with a non-zero number (e.g., "12345", not "01234")
 */

/**
 * Extract the student ID digits from a combined ID
 * "xx1234" → "1234", "xx12345" → "12345"
 * 
 * @param combinedId - The full ID with 2-letter prefix
 * @returns The extracted numeric portion, or null if invalid
 */
export function extractStudentId(combinedId: string | null | undefined): string | null {
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
 * Validate a student ID format from CSV
 * Must be 4 or 5 digits
 * 
 * @param id - The ID from CSV
 * @returns true if valid format
 */
export function isValidStudentIdFormat(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  const trimmed = id.trim();
  
  // Must be all digits
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  
  // Must be 4 or 5 digits
  return trimmed.length >= 4 && trimmed.length <= 5;
}

/**
 * Normalize a student ID from CSV
 * Trims whitespace and validates format
 * 
 * @param id - Raw ID from CSV
 * @returns Normalized ID string or null if invalid
 */
export function normalizeStudentId(id: string | null | undefined): string | null {
  if (!id || typeof id !== 'string') {
    return null;
  }
  
  const trimmed = id.trim();
  
  if (!isValidStudentIdFormat(trimmed)) {
    return null;
  }
  
  return trimmed;
}

/**
 * Validate a combined student ID (with prefix)
 * Must be 2 letters + 4-5 digits
 * 
 * @param combinedId - The full ID with prefix
 * @returns true if valid format
 */
export function isValidCombinedId(combinedId: string | null | undefined): boolean {
  if (!combinedId || typeof combinedId !== 'string') {
    return false;
  }
  
  const trimmed = combinedId.trim();
  
  // Must be 6-7 characters (2 prefix + 4-5 digits)
  if (trimmed.length < 6 || trimmed.length > 7) {
    return false;
  }
  
  // First 2 characters should be letters (case insensitive)
  const prefix = trimmed.substring(0, 2);
  if (!/^[a-zA-Z]{2}$/.test(prefix)) {
    return false;
  }
  
  // Rest should be digits
  const digits = trimmed.substring(2);
  return /^\d{4,5}$/.test(digits);
}
