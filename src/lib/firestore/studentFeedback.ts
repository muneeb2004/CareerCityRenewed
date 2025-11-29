// Prompt for Copilot: "Create a Firestore function to add feedback for a student."

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const addStudentFeedback = async (
  studentId: string,
  feedback: string
): Promise<void> => {
  const feedbackCollection = collection(db, 'studentFeedback');

  await addDoc(feedbackCollection, {
    studentId,
    feedback,
    createdAt: serverTimestamp(),
  });
};
