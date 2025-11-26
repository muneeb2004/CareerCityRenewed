import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { FeedbackQuestion } from '../types';

export const createFeedbackQuestion = async (
  question: Omit<FeedbackQuestion, 'questionId'>
): Promise<string> => {
  const questionsRef = collection(db, 'feedbackQuestions');
  const docRef = await addDoc(questionsRef, {
    ...question,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getAllFeedbackQuestions = async (): Promise<FeedbackQuestion[]> => {
  const questionsRef = collection(db, 'feedbackQuestions');
  const snapshot = await getDocs(questionsRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        questionId: doc.id,
      } as FeedbackQuestion)
  );
};

export const updateFeedbackQuestion = async (
  questionId: string,
  data: Partial<FeedbackQuestion>
): Promise<void> => {
  const questionRef = doc(db, 'feedbackQuestions', questionId);
  await updateDoc(questionRef, data);
};

export const deleteFeedbackQuestion = async (
  questionId: string
): Promise<void> => {
  const questionRef = doc(db, 'feedbackQuestions', questionId);
  await deleteDoc(questionRef);
};
