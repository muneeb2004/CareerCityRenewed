'use server';

import dbConnect from '@/lib/db';
import { StudentFeedback, OrgFeedback } from '@/models/Feedback';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';

// --- Student Feedback ---

export async function addStudentFeedback(
  studentId: string,
  responses: Record<string, string | number | string[]>
): Promise<void> {
  await dbConnect();
  const feedbackId = `feedback_${studentId}`;

  try {
    await StudentFeedback.create({
      feedbackId,
      studentId,
      responses,
      timestamp: new Date()
    });

    // Mark student as having submitted feedback
    await Student.updateOne({ studentId }, { feedbackSubmitted: true, feedbackId });

  } catch (error) {
    console.error('Error adding student feedback:', error);
    throw new Error('Failed to submit feedback');
  }
}

export async function hasStudentSubmittedFeedback(studentId: string): Promise<boolean> {
  await dbConnect();
  try {
    const exists = await StudentFeedback.exists({ studentId });
    return !!exists;
  } catch (error) {
    console.error('Error checking student feedback:', error);
    return false;
  }
}

// --- Organization Feedback ---

export async function addOrganizationFeedback(
  organizationId: string,
  responses: Record<string, string | number | string[]>
): Promise<void> {
  await dbConnect();
  const feedbackId = `feedback_${organizationId}`;

  try {
    await OrgFeedback.create({
      feedbackId,
      organizationId,
      responses,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error adding organization feedback:', error);
    throw new Error('Failed to submit feedback');
  }
}

export async function hasOrganizationSubmittedFeedback(organizationId: string): Promise<boolean> {
  await dbConnect();
  try {
    const exists = await OrgFeedback.exists({ organizationId });
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
    const feedback = await StudentFeedback.findOne({ studentId }).lean();
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
