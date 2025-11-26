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

export interface OrganizationFeedback {
  feedbackId: string;
  organizationId: string;
  timestamp: Timestamp;
  responses: {
    studentEngagement: number; // 1-5
    qualityOfInteractions: number; // 1-5
    hiringInterest: string[];
    suggestions: string;
  };
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
  action: 'check-in' | 'check-out' | 'cv-check' | 'quality-check';
  studentId?: string; // for cv-check and quality-check
  notes?: string;
}

export interface InteractionLog {
  logId: string;
  volunteerId: string;
  studentId: string;
  organizationId: string;
  timestamp: Timestamp;
  notes: string;
}