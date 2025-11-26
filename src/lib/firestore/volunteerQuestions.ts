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
  const questionsRef = collection(db, 'volunteerQuestions');
  const docRef = await addDoc(questionsRef, {
    ...question,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getAllVolunteerQuestions = async (): Promise<VolunteerQuestion[]> => {
  const questionsRef = collection(db, 'volunteerQuestions');
  const snapshot = await getDocs(questionsRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        questionId: doc.id,
      } as VolunteerQuestion)
  );
};

export const updateVolunteerQuestion = async (
  questionId: string,
  data: Partial<VolunteerQuestion>
): Promise<void> => {
  const questionRef = doc(db, 'volunteerQuestions', questionId);
  await updateDoc(questionRef, data);
};

export const deleteVolunteerQuestion = async (
  questionId: string
): Promise<void> => {
  const questionRef = doc(db, 'volunteerQuestions', questionId);
  await deleteDoc(questionRef);
};
