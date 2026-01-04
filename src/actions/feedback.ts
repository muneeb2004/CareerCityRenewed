'use server';

import dbConnect from '@/lib/db';
import { StudentFeedback, OrgFeedback } from '@/models/Feedback';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { StudentIdSchema, OrganizationIdSchema, FeedbackResponsesSchema, validateOrThrow } from '@/lib/schemas';
import { sanitizeFeedbackResponses, safeEquals } from '@/lib/sanitize';
import { handleError } from '@/lib/error-handler';
import { 
  logFeedbackSubmission, 
  logValidationFailure,
  logUnhandledError,
  logDataIntegrityFailure
} from '@/lib/security-logger';
import { verifyChecksum, generateChecksum } from '@/lib/integrity';

// --- Student Feedback ---

/**
 * Add student feedback with optional integrity verification
 * @param studentId - Student identifier
 * @param responses - Feedback responses
 * @param checksum - Optional SHA-256 checksum of responses for integrity verification
 */
export async function addStudentFeedback(
  studentId: string,
  responses: Record<string, string | number | string[]>,
  checksum?: string
): Promise<void> {
  await dbConnect();

  try {
    // Validate inputs
    const validatedStudentId = validateOrThrow(StudentIdSchema, studentId);
    const validatedResponses = validateOrThrow(FeedbackResponsesSchema, responses);
    
    // Verify data integrity if checksum provided
    if (checksum) {
      const isValid = verifyChecksum(validatedResponses, checksum);
      if (!isValid) {
        await logDataIntegrityFailure(
          'student_feedback',
          `Checksum mismatch - expected: ${checksum.slice(0, 8)}..., actual: ${generateChecksum(validatedResponses).slice(0, 8)}...`,
          validatedStudentId
        );
        throw new Error('Data integrity verification failed. Please try again.');
      }
    }
    
    // Sanitize responses for extra safety
    const sanitizedResponses = sanitizeFeedbackResponses(validatedResponses);
    
    const feedbackId = `feedback_${validatedStudentId}`;

    await StudentFeedback.create({
      feedbackId,
      studentId: validatedStudentId,
      responses: sanitizedResponses,
      timestamp: new Date()
    });

    // Mark student as having submitted feedback - use safe equals
    await Student.updateOne(
      { studentId: safeEquals(validatedStudentId) }, 
      { feedbackSubmitted: true, feedbackId }
    );

    // Log successful feedback submission
    await logFeedbackSubmission('student', validatedStudentId, true);

  } catch (error) {
    // Log failed feedback submission
    await logFeedbackSubmission('student', studentId, false);
    
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function hasStudentSubmittedFeedback(studentId: string): Promise<boolean> {
  await dbConnect();
  try {
    // Validate input
    const validatedStudentId = validateOrThrow(StudentIdSchema, studentId);
    
    const exists = await StudentFeedback.exists({ studentId: safeEquals(validatedStudentId) });
    return !!exists;
  } catch (error) {
    console.error('Error checking student feedback:', error);
    return false;
  }
}

// --- Organization Feedback ---

/**
 * Add organization feedback with optional integrity verification
 * @param organizationId - Organization identifier
 * @param responses - Feedback responses
 * @param checksum - Optional SHA-256 checksum of responses for integrity verification
 */
export async function addOrganizationFeedback(
  organizationId: string,
  responses: Record<string, string | number | string[]>,
  checksum?: string
): Promise<void> {
  await dbConnect();

  try {
    // Validate inputs
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    const validatedResponses = validateOrThrow(FeedbackResponsesSchema, responses);
    
    // Verify data integrity if checksum provided
    if (checksum) {
      const isValid = verifyChecksum(validatedResponses, checksum);
      if (!isValid) {
        await logDataIntegrityFailure(
          'organization_feedback',
          `Checksum mismatch - expected: ${checksum.slice(0, 8)}..., actual: ${generateChecksum(validatedResponses).slice(0, 8)}...`,
          validatedOrgId
        );
        throw new Error('Data integrity verification failed. Please try again.');
      }
    }
    
    // Sanitize responses for extra safety
    const sanitizedResponses = sanitizeFeedbackResponses(validatedResponses);
    
    const feedbackId = `feedback_${validatedOrgId}`;

    await OrgFeedback.create({
      feedbackId,
      organizationId: validatedOrgId,
      responses: sanitizedResponses,
      timestamp: new Date()
    });

    // Log successful feedback submission
    await logFeedbackSubmission('organization', validatedOrgId, true);

  } catch (error) {
    // Log failed feedback submission
    await logFeedbackSubmission('organization', organizationId, false);
    
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function hasOrganizationSubmittedFeedback(organizationId: string): Promise<boolean> {
  await dbConnect();
  try {
    // Validate input
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    
    const exists = await OrgFeedback.exists({ organizationId: safeEquals(validatedOrgId) });
    return !!exists;
  } catch (error) {
    console.error('Error checking organization feedback:', error);
    return false;
  }
}

// --- Retrieval Actions for Staff Pages ---

export interface StudentFeedbackRecord {
  feedbackId: string;
  studentId: string;
  responses: Record<string, string | number | string[]>;
  createdAt: string;
}

// Helper to serialize dates for client components
function serializeDate(date: any): string {
  if (!date) return new Date().toISOString();
  return date?.toISOString?.() ?? date;
}

export async function getAllStudentFeedback(): Promise<StudentFeedbackRecord[]> {
  await dbConnect();
  try {
    const feedback = await StudentFeedback.find({}).lean();
    return feedback.map(f => ({
      feedbackId: f.feedbackId,
      studentId: f.studentId || '',
      responses: f.responses instanceof Map ? Object.fromEntries(f.responses) : (f.responses || {}),
      createdAt: serializeDate(f.timestamp),
    }));
  } catch (error) {
    console.error('Error getting all student feedback:', error);
    return [];
  }
}

export async function getStudentFeedbackByStudentId(studentId: string): Promise<StudentFeedbackRecord | null> {
  await dbConnect();
  try {
    // Validate input
    const validatedStudentId = validateOrThrow(StudentIdSchema, studentId);
    
    const feedback = await StudentFeedback.findOne({ studentId: safeEquals(validatedStudentId) }).lean();
    if (!feedback) return null;
    
    return {
      feedbackId: feedback.feedbackId,
      studentId: feedback.studentId || '',
      responses: feedback.responses instanceof Map ? Object.fromEntries(feedback.responses) : (feedback.responses || {}),
      createdAt: serializeDate(feedback.timestamp),
    };
  } catch (error) {
    console.error('Error getting student feedback:', error);
    return null;
  }
}

export async function getAllOrganizationFeedback(): Promise<any[]> {
  await dbConnect();
  try {
    const feedback = await OrgFeedback.find({}).lean();
    return feedback.map(f => ({
      feedbackId: f.feedbackId,
      organizationId: f.organizationId || '',
      responses: f.responses instanceof Map ? Object.fromEntries(f.responses) : (f.responses || {}),
      createdAt: serializeDate(f.timestamp),
    }));
  } catch (error) {
    console.error('Error getting all organization feedback:', error);
    return [];
  }
}
