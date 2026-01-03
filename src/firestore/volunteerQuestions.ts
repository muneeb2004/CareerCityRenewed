import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VolunteerQuestion } from '../types';

// Helper to create a meaningful ID from text
const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

export const createVolunteerQuestion = async (
  question: Omit<VolunteerQuestion, 'questionId'>
): Promise<string> => {
  try {
    console.log('Firestore instance:', db); // Debug log
    
    // Generate a meaningful ID from the question text
    const slugId = createSlug(question.text);
    
    // Fallback if slug is empty (e.g. question text was only special chars)
    const finalId = slugId || `question-${Date.now()}`;

    const docRef = doc(db, 'volunteerQuestions', finalId);

    try {
      await setDoc(docRef, {
        ...question,
        createdAt: serverTimestamp(),
      });
      console.log('Volunteer Question added to Firestore with ID: ', finalId);
    } catch (setDocError: unknown) {
      console.error('Error adding document:', setDocError);
      throw setDocError;
    }
    return finalId;
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
