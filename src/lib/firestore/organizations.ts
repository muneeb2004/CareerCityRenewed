// Prompt for Copilot: "Create Firestore functions for employer CRUD: createEmployer, getEmployer, getAllEmployers, updateEmployerVisitors"

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
  increment,
  QuerySnapshot,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Organization } from '../types';

export const getOrganization = async (organizationId: string): Promise<Organization | null> => {
  const organizationRef = doc(db, 'organizations', organizationId);
  const organizationSnap = await getDoc(organizationRef);

  if (!organizationSnap.exists()) return null;

  return { ...organizationSnap.data(), organizationId } as Organization;
};

export const createOrganization = async (organization: Omit<Organization, 'visitors' | 'visitorCount'>): Promise<void> => {
  const organizationRef = doc(db, 'organizations', organization.organizationId);

  await setDoc(organizationRef, {
    ...organization,
    visitors: [],
    visitorCount: 0,
  });
};

export const getAllOrganizations = async (): Promise<Organization[]> => {
  const organizationsRef = collection(db, 'organizations');
  const snapshot = await getDocs(organizationsRef);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        organizationId: doc.id,
      } as Organization)
  );
};

export const getOrganizationsByIds = async (organizationIds: string[]): Promise<Organization[]> => {
  if (organizationIds.length === 0) {
    return [];
  }
  const organizationsRef = collection(db, 'organizations');
  const q = query(organizationsRef, where(documentId(), 'in', organizationIds));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        organizationId: doc.id,
      } as Organization)
  );
};

export const updateOrganizationVisitors = async (
  organizationId: string,
  studentId: string
): Promise<void> => {
  const organizationRef = doc(db, 'organizations', organizationId);

  await updateDoc(organizationRef, {
    visitors: arrayUnion(studentId),
    visitorCount: increment(1),
  });
};