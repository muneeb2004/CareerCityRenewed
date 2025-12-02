// Prompt for Copilot: "Create TypeScript types for Student, Employer, Scan, and Feedback with Firestore Timestamp"

import { Timestamp } from 'firebase/firestore';

export const PROGRAMS = [
  'Computer Science',
  'Computer Engineering',
  'Electrical Engineering',
  'Communication & Design',
  'Social Development & Policy',
  'Comparative Humanities',
] as const;

export type Program = typeof PROGRAMS[number];

export interface Student {
  studentId: string;
  email: string;
  program: Program;
  visitedStalls: string[];
  scanCount: number;
  registeredAt: Timestamp;
  lastScanTime: Timestamp;
  feedbackSubmitted: boolean;
  feedbackId?: string;
}

export interface Organization {
  organizationId: string;
  name: string;
  industry: string;
  boothNumber: string;
  qrCode: string;
  logo?: string;
  contactPerson: string;
  email: string;
  category: string;
  visitors: string[];
  visitorCount: number;
}

export interface Scan {
  scanId: string;
  studentId: string;
  studentEmail: string;
  studentProgram: Program;
  organizationId: string;
  organizationName: string;
  boothNumber: string;
  timestamp: Timestamp;
  scanMethod: 'qr_code';
}

export interface StudentFeedback {
  feedbackId: string;
  studentId: string;
  timestamp: Timestamp;
  responses: {
    overallExperience: number; // 1-5
    stallsVisited: number;
    mostHelpfulStall: string;
    suggestions: string;
  };
}

// Question Types:
// - range: Scale/rating (1-5, 1-10)
// - number: Numeric input (e.g., count of CVs collected)
// - multiplechoice: Radio buttons (single selection)
// - checkbox: Checkboxes (multiple selection)
// - text: Short text input
// - textarea: Long text input
// - scale_text: Combined scale + text follow-up
// - multiplechoice_text: Combined multiple choice + text follow-up
// - organization_select: Special type for selecting favorite organizations
export const QUESTION_TYPES = [
  'range',
  'number', 
  'multiplechoice',
  'checkbox',
  'text',
  'textarea',
  'scale_text',
  'multiplechoice_text',
  'organization_select',
] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

// Human-readable labels for question types
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  range: 'Range/Scale (1-5)',
  number: 'Number',
  multiplechoice: 'Multiple Choice (Single)',
  checkbox: 'Multiple Choice (Multi)',
  text: 'Short Text',
  textarea: 'Long Text',
  scale_text: 'Scale + Text',
  multiplechoice_text: 'Multiple Choice + Text',
  organization_select: 'Organization Selection',
};

export interface OrganizationFeedbackQuestion {
  questionId: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For multiplechoice, checkbox
  minLabel?: string;  // For range/scale types
  maxLabel?: string;  // For range/scale types
  scaleMax?: number;  // Max value for scale (default 5)
  followUpLabel?: string; // Label for combined type text input
  placeholder?: string; // Placeholder for text inputs
  allowOther?: boolean; // Allow "Other" option with text input
}

export interface VolunteerQuestion {
  questionId: string;
  text: string;
  type: QuestionType;
  options?: string[];   // For multiplechoice, checkbox
  minLabel?: string;    // For range/scale types
  maxLabel?: string;    // For range/scale types
  scaleMax?: number;    // Max value for scale (default 5)
  followUpLabel?: string; // Label for combined type text input
  placeholder?: string; // Placeholder for text inputs
  allowOther?: boolean; // Allow "Other" option with text input
  // Organization selection specific fields
  selectionCount?: number; // Number of organizations to select (e.g., 5)
  isPerOrganization?: boolean; // If true, this question repeats for each selected org
  linkedToQuestionId?: string; // Links to the organization_select question
}

export interface OrganizationFeedback {
  feedbackId: string;
  organizationId: string;
  timestamp: Timestamp;
  responses: { [questionId: string]: string | number | string[] };
}

export interface Staff {
  staffId: string;
  name: string;
  email: string;
  role: 'admin' | 'coordinator';
  permissions: string[];
}

export interface Volunteer {
  volunteerId: string;
  name: string;
  email: string;
  phone: string;
  role: 'Captain' | 'Member';
}

export interface VolunteerLog {
  logId: string;
  volunteerId: string;
  timestamp: Timestamp;
  action: 'check-in' | 'check-out' | 'quality-check';
  studentId?: string; // for quality-check
  notes?: string;
}

export interface InteractionLog {
  logId: string;
  volunteerId: string;
  studentId: string;
  organizationId: string;
  timestamp: Timestamp;
  responses: { [questionId: string]: string | number | string[] };
}