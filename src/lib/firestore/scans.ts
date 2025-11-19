// Prompt for Copilot: "Create Firestore function to create scan record with student and employer details"

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Program } from '../types';

export const createScan = async (
  studentId: string,
  studentEmail: string,
  studentProgram: Program,
  employerId: string,
  employerName: string,
  boothNumber: string
): Promise<void> => {
  const scansRef = collection(db, 'scans');
  
  await addDoc(scansRef, {
    studentId,
    studentEmail,
    studentProgram,
    employerId,
    employerName,
    boothNumber,
    timestamp: serverTimestamp(),
    scanMethod: 'qr_code',
  });
};