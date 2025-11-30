import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrganizationFeedbackQuestion } from '../types';

export const createOrganizationFeedbackQuestion = async (
  question: Omit<OrganizationFeedbackQuestion, 'questionId'>
): Promise<string> => {
  try {
    console.log('Firestore instance:', db); // Debug log
    let questionsRef;
    try {
      console.log('Firestore: Attempting to get collection reference.'); // Debug log
      questionsRef = collection(db, 'organizationFeedbackQuestions');
      console.log('Firestore: collection ref obtained.'); // Debug log
    } catch (collectionError: unknown) {
      console.error('Error getting collection reference:', collectionError);
      throw collectionError;
    }
    let docRef;
    try {
      docRef = await addDoc(questionsRef, {
        ...question,
        createdAt: serverTimestamp(),
      });
      console.log('Question added to Firestore with ID: ', docRef.id); // NEW LOG
    } catch (addDocError: unknown) {
      console.error('Error adding document:', addDocError);
      throw addDocError;
    }
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
