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
    console.log('Firestore instance:', db); // Debug log
    let questionsRef;
    try {
      console.log('Firestore: Attempting to get collection reference.'); // Debug log
      questionsRef = collection(db, 'volunteerQuestions');
      console.log('Firestore: collection ref obtained.'); // Debug log
    } catch (collectionError: any) {
      console.error('Error getting collection reference:', collectionError);
      throw collectionError;
    }
    const docRef = await addDoc(questionsRef, {
      ...question,
      createdAt: serverTimestamp(),
    });
    console.log("Volunteer Question added to Firestore with ID: ", docRef.id); // NEW LOG
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
