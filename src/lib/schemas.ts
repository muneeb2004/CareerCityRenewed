/**
 * Zod Validation Schemas
 * 
 * Centralized validation schemas for all input types.
 * Prevents injection attacks and ensures data integrity.
 */

import { z } from 'zod';
import { PROGRAMS } from '@/types';

// ============================================
// Base Schemas
// ============================================

/**
 * Student ID: 2 letters followed by 5 digits (e.g., ab12345)
 */
export const StudentIdSchema = z.string()
  .min(7, 'Student ID must be 7 characters')
  .max(7, 'Student ID must be 7 characters')
  .regex(/^[a-zA-Z]{2}\d{5}$/, 'Invalid format. Use: xx##### (e.g., ab12345)')
  .transform(val => val.toLowerCase());

/**
 * Student Email: studentId@st.habib.edu.pk
 */
export const StudentEmailSchema = z.string()
  .email('Invalid email format')
  .max(255)
  .regex(/^[a-z]{2}\d{5}@st\.habib\.edu\.pk$/, 'Must be a valid Habib email');

/**
 * Organization ID: org_ followed by alphanumeric (e.g., org_abc123)
 */
export const OrganizationIdSchema = z.string()
  .min(4, 'Organization ID too short')
  .max(50, 'Organization ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid organization ID format');

/**
 * Question Slug: lowercase, hyphens allowed
 */
export const QuestionSlugSchema = z.string()
  .min(1, 'Slug is required')
  .max(100, 'Slug too long')
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only');

/**
 * MongoDB ObjectId string
 */
export const ObjectIdSchema = z.string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID format');

/**
 * Program from allowed list
 */
export const ProgramSchema = z.enum(PROGRAMS);

// ============================================
// Entity Schemas
// ============================================

/**
 * Full name validation
 */
export const FullNameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be under 100 characters')
  .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters');

/**
 * Booth number validation
 */
export const BoothNumberSchema = z.string()
  .min(1, 'Booth number is required')
  .max(10, 'Booth number too long')
  .regex(/^[A-Za-z0-9-]+$/, 'Invalid booth number format');

/**
 * Organization name
 */
export const OrganizationNameSchema = z.string()
  .min(2, 'Organization name too short')
  .max(200, 'Organization name too long');

/**
 * Industry/Category
 */
export const IndustrySchema = z.string()
  .min(2, 'Industry name too short')
  .max(100, 'Industry name too long');

/**
 * Contact person name
 */
export const ContactPersonSchema = z.string()
  .min(2, 'Contact person name too short')
  .max(100, 'Contact person name too long');

/**
 * Generic email
 */
export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long');

// ============================================
// Feedback Schemas
// ============================================

/**
 * Feedback response value (string, number, or array)
 */
export const FeedbackResponseValueSchema = z.union([
  z.string().max(1000, 'Response too long'),
  z.number().min(1).max(10),
  z.array(z.string().max(200)).max(10),
]);

/**
 * Feedback responses record
 */
export const FeedbackResponsesSchema = z.record(
  z.string().max(100), // Key (question ID)
  FeedbackResponseValueSchema
);

/**
 * Student feedback submission
 */
export const StudentFeedbackSchema = z.object({
  studentId: StudentIdSchema,
  responses: FeedbackResponsesSchema,
});

/**
 * Organization feedback submission
 */
export const OrganizationFeedbackSchema = z.object({
  organizationId: OrganizationIdSchema,
  responses: FeedbackResponsesSchema,
});

// ============================================
// Question Schemas
// ============================================

/**
 * Question types
 */
export const QuestionTypeSchema = z.enum([
  'text',
  'rating',
  'multiple_choice',
  'checkbox',
  'dropdown',
]);

/**
 * Question option
 */
export const QuestionOptionSchema = z.object({
  value: z.string().max(200),
  label: z.string().max(200),
});

/**
 * Question creation/update
 */
export const QuestionSchema = z.object({
  text: z.string().min(5, 'Question too short').max(500, 'Question too long'),
  type: QuestionTypeSchema,
  required: z.boolean().default(true),
  order: z.number().int().min(0).max(100).default(0),
  options: z.array(QuestionOptionSchema).max(20).optional(),
});

// ============================================
// Organization Schemas
// ============================================

/**
 * Organization creation
 */
export const CreateOrganizationSchema = z.object({
  organizationId: OrganizationIdSchema,
  name: OrganizationNameSchema,
  industry: IndustrySchema,
  boothNumber: BoothNumberSchema,
  qrCode: z.string().max(5000),
  logo: z.string().url().max(500).optional(),
  contactPerson: ContactPersonSchema,
  email: EmailSchema,
  category: z.string().min(2).max(100),
});

/**
 * Organization update (partial)
 */
export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

// ============================================
// Student Schemas
// ============================================

/**
 * Student registration
 */
export const CreateStudentSchema = z.object({
  studentId: StudentIdSchema,
  email: StudentEmailSchema,
  fullName: FullNameSchema,
  organizationId: OrganizationIdSchema,
  organizationName: OrganizationNameSchema,
  boothNumber: BoothNumberSchema,
});

// ============================================
// Scan Schemas
// ============================================

/**
 * Record visit (scan)
 */
export const RecordVisitSchema = z.object({
  studentId: StudentIdSchema,
  studentEmail: StudentEmailSchema,
  studentProgram: z.string().max(100),
  organizationId: OrganizationIdSchema,
  organizationName: OrganizationNameSchema,
  boothNumber: BoothNumberSchema,
});

// ============================================
// Search & Filter Schemas
// ============================================

/**
 * Search query
 */
export const SearchQuerySchema = z.string()
  .max(100, 'Search query too long')
  .transform(val => val.trim());

/**
 * Pagination
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validate and return data or throw with formatted errors
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  
  return result.data;
}

/**
 * Validate and return result object
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Check if value is safe (not an injection attempt)
 */
export function isSafeValue(value: unknown): boolean {
  if (typeof value === 'object' && value !== null) {
    // Check for MongoDB operator injection
    const keys = Object.keys(value);
    if (keys.some(k => k.startsWith('$'))) {
      return false;
    }
  }
  return true;
}
