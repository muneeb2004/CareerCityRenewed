// Prompt for Copilot: "Create localStorage utilities for student session management with expiration (12 hours)"

import { Program } from './types';

const STORAGE_KEYS = {
  STUDENT_ID: 'hu_career_city_student',
  PROGRAM: 'hu_career_city_program',
  SESSION_START: 'hu_career_city_session_start',
} as const;

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export interface StudentSession {
  studentId: string;
  program: Program;
}

export const saveStudentSession = (studentId: string, program: Program): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.STUDENT_ID, studentId);
  localStorage.setItem(STORAGE_KEYS.PROGRAM, program);
  localStorage.setItem(STORAGE_KEYS.SESSION_START, Date.now().toString());
};

export const getStudentSession = (): StudentSession | null => {
  if (typeof window === 'undefined') return null;
  
  const studentId = localStorage.getItem(STORAGE_KEYS.STUDENT_ID);
  const program = localStorage.getItem(STORAGE_KEYS.PROGRAM);
  const sessionStart = localStorage.getItem(STORAGE_KEYS.SESSION_START);
  
  if (!studentId || !program || !sessionStart) return null;
  
  // Check if session expired
  if (Date.now() - parseInt(sessionStart) > TWELVE_HOURS) {
    clearStudentSession();
    return null;
  }
  
  return { studentId, program: program as Program };
};

export const clearStudentSession = (): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.STUDENT_ID);
  localStorage.removeItem(STORAGE_KEYS.PROGRAM);
  localStorage.removeItem(STORAGE_KEYS.SESSION_START);
};