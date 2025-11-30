// Prompt for Copilot: "Create a Firestore function to add feedback for an organization."

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const addOrganizationFeedback = async (
  organizationId: string,
  responses: Record<string, string | number | string[]>
): Promise<void> => {
  const feedbackCollection = collection(db, 'organizationFeedback');

  await addDoc(feedbackCollection, {
    organizationId,
    responses,
    createdAt: serverTimestamp(),
  });
};
