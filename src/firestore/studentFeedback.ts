// Prompt for Copilot: "Create a Firestore function to add feedback for a student."

import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
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
  const feedbackCollection = collection(db, 'studentFeedback');

  await addDoc(feedbackCollection, {
    studentId,
    responses,
    createdAt: serverTimestamp(),
  });
};

export const getAllStudentFeedback = async (): Promise<StudentFeedbackRecord[]> => {
  const feedbackCollection = collection(db, 'studentFeedback');
  const snapshot = await getDocs(feedbackCollection);
  return snapshot.docs.map((doc) => ({
    feedbackId: doc.id,
    studentId: doc.data().studentId,
    responses: doc.data().responses,
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  }));
};

export const getStudentFeedbackByStudentId = async (
  studentId: string
): Promise<StudentFeedbackRecord | null> => {
  const feedbackCollection = collection(db, 'studentFeedback');
  const q = query(feedbackCollection, where('studentId', '==', studentId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    feedbackId: doc.id,
    studentId: doc.data().studentId,
    responses: doc.data().responses,
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  };
};
