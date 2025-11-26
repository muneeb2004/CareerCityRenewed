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
import { OrganizationFeedbackQuestion } from '../types';

export const createOrganizationFeedbackQuestion = async (
  question: Omit<OrganizationFeedbackQuestion, 'questionId'>
): Promise<string> => {
  const questionsRef = collection(db, 'organizationFeedbackQuestions');
  const docRef = await addDoc(questionsRef, {
    ...question,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getAllOrganizationFeedbackQuestions = async (): Promise<OrganizationFeedbackQuestion[]> => {
  const questionsRef = collection(db, 'organizationFeedbackQuestions');
  const snapshot = await getDocs(questionsRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        questionId: doc.id,
      } as OrganizationFeedbackQuestion)
  );
};

export const updateOrganizationFeedbackQuestion = async (
  questionId: string,
  data: Partial<OrganizationFeedbackQuestion>
): Promise<void> => {
  const questionRef = doc(db, 'organizationFeedbackQuestions', questionId);
  await updateDoc(questionRef, data);
};

export const deleteOrganizationFeedbackQuestion = async (
  questionId: string
): Promise<void> => {
  const questionRef = doc(db, 'organizationFeedbackQuestions', questionId);
  await deleteDoc(questionRef);
};
