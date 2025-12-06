// Prompt for Copilot: "Create a Firestore function to add feedback for a student."

import { collection, doc, setDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface StudentFeedbackRecord {
  feedbackId: string;
  studentId: string;
  responses: Record<string, string | number | string[]>;
  createdAt: Date;
}

export const addStudentFeedback = async (
  studentId: string,
  responses: Record<string, string | number | string[]>
): Promise<void> => {
  // Use studentId as document ID for easy lookup and to prevent duplicates
  const feedbackRef = doc(db, 'studentFeedback', studentId);

  await setDoc(feedbackRef, {
    studentId,
    responses,
    createdAt: serverTimestamp(),
  });
};

export const getAllStudentFeedback = async (): Promise<StudentFeedbackRecord[]> => {
  const feedbackCollection = collection(db, 'studentFeedback');
  const snapshot = await getDocs(feedbackCollection);
  return snapshot.docs.map((docSnap) => ({
    feedbackId: docSnap.id,
    studentId: docSnap.data().studentId,
    responses: docSnap.data().responses,
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
  }));
};

export const getStudentFeedbackByStudentId = async (
  studentId: string
): Promise<StudentFeedbackRecord | null> => {
  // Direct document lookup by studentId (since it's the document ID)
  const feedbackRef = doc(db, 'studentFeedback', studentId);
  const docSnap = await getDoc(feedbackRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    feedbackId: docSnap.id,
    studentId: docSnap.data().studentId,
    responses: docSnap.data().responses,
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
  };
};

// Check if student has already submitted feedback
export const hasStudentSubmittedFeedback = async (studentId: string): Promise<boolean> => {
  const feedbackRef = doc(db, 'studentFeedback', studentId);
  const docSnap = await getDoc(feedbackRef);
  return docSnap.exists();
};
