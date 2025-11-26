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
import { VolunteerQuestion } from '../types';

export const createVolunteerQuestion = async (
  question: Omit<VolunteerQuestion, 'questionId'>
): Promise<string> => {
  try {
    const questionsRef = collection(db, 'volunteerQuestions');
    const docRef = await addDoc(questionsRef, {
      ...question,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating volunteer question in Firestore: ', error);
    throw error;
  }
};

export const getAllVolunteerQuestions = async (): Promise<
  VolunteerQuestion[]
> => {
  try {
    const questionsRef = collection(db, 'volunteerQuestions');
    const snapshot = await getDocs(questionsRef);
    return snapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          questionId: doc.id,
        } as VolunteerQuestion)
    );
  } catch (error) {
    console.error('Error getting volunteer questions from Firestore: ', error);
    throw error;
  }
};

export const updateVolunteerQuestion = async (
  questionId: string,
  data: Partial<VolunteerQuestion>
): Promise<void> => {
  try {
    const questionRef = doc(db, 'volunteerQuestions', questionId);
    await updateDoc(questionRef, data);
  } catch (error) {
    console.error('Error updating volunteer question in Firestore: ', error);
    throw error;
  }
};

export const deleteVolunteerQuestion = async (
  questionId: string
): Promise<void> => {
  try {
    const questionRef = doc(db, 'volunteerQuestions', questionId);
    await deleteDoc(questionRef);
  } catch (error) {
    console.error('Error deleting volunteer question in Firestore: ', error);
    throw error;
  }
};
