// Prompt for Copilot: "Create validation functions for student ID format (2 letters + 5 digits), email generation, and program validation"

import { PROGRAMS, Program } from '../types';

export const validateStudentId = (id: string): { isValid: boolean; error: string | null } => {
  const regex = /^[a-zA-Z]{2}\d{5}$/;
  
  if (!regex.test(id)) {
    return {
      isValid: false,
      error: 'Invalid format. Use: xx##### (e.g., ab12345)',
    };
  }
  
  return { isValid: true, error: null };
};

export const generateEmail = (studentId: string): string => {
  return `${studentId.toLowerCase()}@st.habib.edu.pk`;
};

export const validateProgram = (program: string): program is Program => {
  return PROGRAMS.includes(program as Program);
};

export const validateEmail = (email: string): boolean => {
  const regex = /^[a-z]{2}\d{5}@st\.habib\.edu\.pk$/;
  return regex.test(email);
};
