import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import mongoose from 'mongoose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Student } from '../src/models/Student';
import { Scan } from '../src/models/Scan';

// We need a service account for this script to run locally against Firestore
// If not present, we skip firestore parts or require user to provide it.
// Assuming user might provide GOOGLE_APPLICATION_CREDENTIALS or similar.
// For now, let's assume we can use the default app if initialized, 
// OR we might need to skip if credentials aren't set.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : undefined;

if (!getApps().length && serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount)
  });
} else if (!getApps().length) {
    console.warn("No Firebase Service Account found. Comparison might fail if not authenticated via other means.");
    // Fallback to default auth if possible (e.g. gcloud auth application-default login)
    initializeApp();
}

const db = getFirestore();

async function compareDatabases() {
  console.log('Starting Database Comparison...');
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  try {
    // 1. Compare Student Counts
    const mongoStudentCount = await Student.countDocuments();
    const firestoreStudentsSnap = await db.collection('students').count().get();
    const firestoreStudentCount = firestoreStudentsSnap.data().count;

    console.log(`Students: Mongo=${mongoStudentCount}, Firestore=${firestoreStudentCount}`);
    
    if (mongoStudentCount !== firestoreStudentCount) {
      console.warn('⚠️ Student counts mismatch!');
    }

    // 2. Compare Scan Counts
    const mongoScanCount = await Scan.countDocuments();
    const firestoreScansSnap = await db.collection('scans').count().get();
    const firestoreScanCount = firestoreScansSnap.data().count;

    console.log(`Scans: Mongo=${mongoScanCount}, Firestore=${firestoreScanCount}`);

    if (mongoScanCount !== firestoreScanCount) {
        console.warn('⚠️ Scan counts mismatch!');
    }

    // 3. Spot Check (Sample 5 Students)
    const sampleStudents = await Student.aggregate([{ $sample: { size: 5 } }]);
    
    for (const student of sampleStudents) {
      const doc = await db.collection('students').doc(student.studentId).get();
      if (!doc.exists) {
        console.error(`❌ Student ${student.studentId} missing in Firestore!`);
        continue;
      }
      
      const fsData = doc.data();
      if (!fsData) continue;

      // Compare basic fields
      if (fsData.email !== student.email) {
         console.error(`❌ Data mismatch for ${student.studentId}: Email`);
      }
      if (fsData.scanCount !== student.scanCount) {
         console.error(`❌ Data mismatch for ${student.studentId}: ScanCount (FS=${fsData.scanCount}, Mongo=${student.scanCount})`);
      }
    }

    console.log('Comparison complete.');

  } catch (error) {
    console.error('Comparison failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

compareDatabases();
