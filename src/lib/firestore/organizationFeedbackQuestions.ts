import {
  collection,
  getDocs,
  doc,
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
  try {
    const questionsRef = collection(db, 'organizationFeedbackQuestions');
    const docRef = await addDoc(questionsRef, {
      ...question,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating question in Firestore: ', error);
    throw error;
  }
};

export const getAllOrganizationFeedbackQuestions = async (): Promise<
  OrganizationFeedbackQuestion[]
> => {
  try {
    const questionsRef = collection(db, 'organizationFeedbackQuestions');
    const snapshot = await getDocs(questionsRef);
    return snapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          questionId: doc.id,
        } as OrganizationFeedbackQuestion)
    );
  } catch (error) {
    console.error('Error getting questions from Firestore: ', error);
    throw error;
  }
};

export const updateOrganizationFeedbackQuestion = async (
  questionId: string,
  data: Partial<OrganizationFeedbackQuestion>
): Promise<void> => {
  try {
    const questionRef = doc(db, 'organizationFeedbackQuestions', questionId);
    await updateDoc(questionRef, data);
  } catch (error) {
    console.error('Error updating question in Firestore: ', error);
    throw error;
  }
};

export const deleteOrganizationFeedbackQuestion = async (
  questionId: string
): Promise<void> => {
  try {
    const questionRef = doc(db, 'organizationFeedbackQuestions', questionId);
    await deleteDoc(questionRef);
  } catch (error) {
    console.error('Error deleting question in Firestore: ', error);
    throw error;
  }
};
