// Prompt for Copilot: "Create a Firestore function to add feedback for an organization."

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const addOrganizationFeedback = async (
  organizationId: string,
  responses: Record<string, string | number | string[]>
): Promise<void> => {
  // Use organizationId as document ID for easy lookup and to prevent duplicates
  const feedbackRef = doc(db, 'organizationFeedback', organizationId);

  await setDoc(feedbackRef, {
    organizationId,
    responses,
    createdAt: serverTimestamp(),
  });
};

// Check if organization has already submitted feedback
export const hasOrganizationSubmittedFeedback = async (organizationId: string): Promise<boolean> => {
  const feedbackRef = doc(db, 'organizationFeedback', organizationId);
  const docSnap = await getDoc(feedbackRef);
  return docSnap.exists();
};
