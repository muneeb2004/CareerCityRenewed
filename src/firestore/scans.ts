// Prompt for Copilot: "Create Firestore function to create scan record with student and employer details"

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  runTransaction,
  doc,
  setDoc,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Program, Scan } from '../types';

export const createScan = async (
  studentId: string,
  studentEmail: string,
  studentProgram: Program,
  organizationId: string,
  organizationName: string,
  boothNumber: string,
  scanCount?: number // Optional: if provided, used to generate ID
): Promise<void> => {
  if (scanCount !== undefined) {
    const scanId = `${studentId}_${scanCount}`;
    const scanRef = doc(db, 'scans', scanId);
    await setDoc(scanRef, {
      studentId,
      studentEmail,
      studentProgram,
      organizationId,
      organizationName,
      boothNumber,
      timestamp: serverTimestamp(),
      scanMethod: 'qr_code',
      scanId, // Store ID in doc as well
    });
  } else {
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
  }
};

export const recordVisit = async (
  studentId: string,
  studentEmail: string,
  studentProgram: Program,
  organizationId: string,
  organizationName: string,
  boothNumber: string
): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    // 1. Get Student to determine next scan count
    const studentRef = doc(db, 'students', studentId);
    const studentDoc = await transaction.get(studentRef);

    if (!studentDoc.exists()) {
      throw new Error("Student does not exist");
    }

    const studentData = studentDoc.data();
    
    // Check if already visited
    if (studentData.visitedStalls?.includes(organizationId)) {
      throw new Error("Already visited this organization");
    }

    const newScanCount = (studentData.scanCount || 0) + 1;
    const scanId = `${studentId}_${newScanCount}`;
    const scanRef = doc(db, 'scans', scanId);
    const orgRef = doc(db, 'organizations', organizationId);

    // 2. Create Scan
    transaction.set(scanRef, {
      studentId,
      studentEmail,
      studentProgram,
      organizationId,
      organizationName,
      boothNumber,
      timestamp: serverTimestamp(),
      scanMethod: 'qr_code',
      scanId
    });

    // 3. Update Student
    transaction.update(studentRef, {
      visitedStalls: arrayUnion(organizationId),
      scanCount: increment(1),
      lastScanTime: serverTimestamp(),
    });

    // 4. Update Organization
    transaction.update(orgRef, {
      visitors: arrayUnion(studentId),
      visitorCount: increment(1),
    });
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
