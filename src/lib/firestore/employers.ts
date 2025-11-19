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
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employer } from '../types';

export const getEmployer = async (employerId: string): Promise<Employer | null> => {
  const employerRef = doc(db, 'employers', employerId);
  const employerSnap = await getDoc(employerRef);
  
  if (!employerSnap.exists()) return null;
  
  return { ...employerSnap.data(), employerId } as Employer;
};

export const createEmployer = async (employer: Omit<Employer, 'visitors' | 'visitorCount'>): Promise<void> => {
  const employerRef = doc(db, 'employers', employer.employerId);
  
  await setDoc(employerRef, {
    ...employer,
    visitors: [],
    visitorCount: 0,
  });
};

export const getAllEmployers = async (): Promise<Employer[]> => {
  const employersRef = collection(db, 'employers');
  const snapshot = await getDocs(employersRef);
  
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    employerId: doc.id,
  } as Employer));
};

export const updateEmployerVisitors = async (
  employerId: string,
  studentId: string
): Promise<void> => {
  const employerRef = doc(db, 'employers', employerId);
  
  await updateDoc(employerRef, {
    visitors: arrayUnion(studentId),
    visitorCount: increment(1),
  });
};