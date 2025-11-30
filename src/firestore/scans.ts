// Prompt for Copilot: "Create Firestore function to create scan record with student and employer details"

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  // Remove orderBy to avoid needing a composite index
  const q = query(
    scansRef,
    where('studentId', '==', studentId)
  );
  const snapshot = await getDocs(q);
  const scans = snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        scanId: doc.id,
      } as Scan)
  );

  // Sort by timestamp descending (client-side)
  return scans.sort((a, b) => {
    const timeA = a.timestamp?.toMillis() || 0;
    const timeB = b.timestamp?.toMillis() || 0;
    return timeB - timeA;
  });
};
