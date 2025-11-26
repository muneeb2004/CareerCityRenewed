// Prompt for Copilot: "Create Firestore functions for student CRUD operations: createStudent, getStudent, updateStudentVisit with arrayUnion and increment"

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Program } from '../types';

export const getStudent = async (studentId: string): Promise<Student | null> => {
  const studentRef = doc(db, 'students', studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) return null;

  return { ...studentSnap.data(), studentId } as Student;
};

export const createStudent = async (
  studentId: string,
  email: string,
  program: Program,
  firstOrganizationId: string
): Promise<void> => {
  const studentRef = doc(db, 'students', studentId);

  await setDoc(studentRef, {
    studentId,
    email,
    program,
    visitedStalls: [firstOrganizationId],
    scanCount: 1,
    registeredAt: serverTimestamp(),
    lastScanTime: serverTimestamp(),
    feedbackSubmitted: false,
  });
};

export const updateStudentVisit = async (
  studentId: string,
  organizationId: string
): Promise<void> => {
  const studentRef = doc(db, 'students', studentId);

  await updateDoc(studentRef, {
    visitedStalls: arrayUnion(organizationId),
    scanCount: increment(1),
    lastScanTime: serverTimestamp(),
  });
};

export const checkIfVisited = async (
  studentId: string,
  organizationId: string
): Promise<boolean> => {
  const student = await getStudent(studentId);
  if (!student) return false;

  return student.visitedStalls.includes(organizationId);
};