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
import { OrganizationFeedbackQuestion } from '../types';

// Helper to create a meaningful ID from text
const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

export const createOrganizationFeedbackQuestion = async (
  question: Omit<OrganizationFeedbackQuestion, 'questionId'>
): Promise<string> => {
  try {
    console.log('Firestore instance:', db); // Debug log
    
    // Generate a meaningful ID from the question text
    const slugId = createSlug(question.text);
    // Ensure uniqueness or handle potential collisions if necessary. 
    // For now, using the slug as the ID directly. 
    // If the question text is identical, it will overwrite, which prevents duplicates.
    // If we wanted to allow duplicates with same text, we'd append a timestamp or random string.
    
    // Fallback if slug is empty (e.g. question text was only special chars)
    const finalId = slugId || `question-${Date.now()}`;

    const docRef = doc(db, 'organizationFeedbackQuestions', finalId);

    try {
      await setDoc(docRef, {
        ...question,
        createdAt: serverTimestamp(),
      });
      console.log('Question added to Firestore with ID: ', finalId);
    } catch (setDocError: unknown) {
      console.error('Error adding document:', setDocError);
      throw setDocError;
    }
    return finalId;
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
