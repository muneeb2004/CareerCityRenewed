// Prompt for Copilot: "Create Firestore function to create scan record with student and employer details"

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Program, Scan } from '../types';

export const createScan = async (
  studentId: string,
  studentEmail: string,
  studentProgram: Program,
  organizationId: string,
  organizationName: string,
  boothNumber: string
): Promise<void> => {
  const scansRef = collection(db, 'scans');

  await addDoc(scansRef, {
    studentId,
    studentEmail,
    studentProgram,
    organizationId,
    organizationName,
    boothNumber,
    timestamp: serverTimestamp(),
    scanMethod: 'qr_code',
  });
};

export const getScansByStudent = async (studentId: string): Promise<Scan[]> => {
  const scansRef = collection(db, 'scans');
  const q = query(
    scansRef,
    where('studentId', '==', studentId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        scanId: doc.id,
      } as Scan)
  );
};