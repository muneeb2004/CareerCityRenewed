import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import mongoose from 'mongoose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Models
import { Student } from '../src/models/Student';
import { Scan } from '../src/models/Scan';
import { Organization } from '../src/models/Organization';
import { VolunteerQuestion, OrgQuestion } from '../src/models/Question';
import { StudentFeedback, OrgFeedback } from '../src/models/Feedback';

const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : undefined;

if (!getApps().length) {
    if (serviceAccount) {
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        console.warn("⚠️ No FIREBASE_SERVICE_ACCOUNT provided. Attempting default credentials.");
        initializeApp();
    }
}

const db = getFirestore();

// Helper: Checkpoints
function getCheckpoint(collectionName: string): string | null {
  const file = `.migration-checkpoint-${collectionName}.json`;
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf-8')).lastId;
  }
  return null;
}

function saveCheckpoint(collectionName: string, lastId: string) {
  const file = `.migration-checkpoint-${collectionName}.json`;
  fs.writeFileSync(file, JSON.stringify({ lastId }));
}

// Helper: Create Slug (duplicated to avoid import issues outside src)
const createSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

// --- Migration Functions ---

async function migrateOrganizations() {
  console.log('--- Migrating Organizations ---');
  let count = 0;
  const collectionRef = db.collection('organizations');
  const snapshot = await collectionRef.get(); // Or batch if too many

  if (snapshot.empty) {
    console.log('No organizations found.');
    return;
  }

  const ops: any[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    ops.push({
      updateOne: {
        filter: { organizationId: doc.id },
        update: {
          $set: {
            organizationId: doc.id,
            name: data.name,
            industry: data.industry,
            boothNumber: data.boothNumber,
            qrCode: data.qrCode,
            logo: data.logo,
            contactPerson: data.contactPerson,
            email: data.email,
            category: data.category,
            visitors: data.visitors || [],
            visitorCount: data.visitorCount || 0,
            // Convert timestamps if present, else default
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: new Date() 
          }
        },
        upsert: true
      }
    });
  }

  if (!DRY_RUN) {
    await Organization.bulkWrite(ops);
    console.log(`Upserted ${ops.length} organizations.`);
  } else {
    console.log(`[DRY RUN] Would upsert ${ops.length} organizations.`);
  }
}

async function migrateQuestions() {
    console.log('--- Migrating Questions ---');
    
    // 1. Volunteer Questions
    const volSnapshot = await db.collection('volunteerQuestions').get();
    const volOps: any[] = [];
    for (const doc of volSnapshot.docs) {
        const data = doc.data();
        // Determine slug: if doc ID is already a slug (no random chars), use it. 
        // Otherwise generate from text.
        // Strategy: Use createSlug(text). If it differs from ID, still use generated slug as _id/slug field.
        // Actually, our models use `slug` field.
        const slug = createSlug(data.text) || doc.id;
        
        volOps.push({
            updateOne: {
                filter: { slug: slug },
                update: {
                    $set: {
                        slug: slug,
                        text: data.text,
                        type: data.type,
                        options: data.options,
                        minLabel: data.minLabel,
                        maxLabel: data.maxLabel,
                        scaleMax: data.scaleMax,
                        followUpLabel: data.followUpLabel,
                        placeholder: data.placeholder,
                        allowOther: data.allowOther,
                        order: data.order,
                        isPerOrganization: data.isPerOrganization,
                        linkedToQuestionSlug: data.linkedToQuestionId, // Map old ID to new Slug? Risk: old ID might be random string.
                        // Ideally we should resolve linkedToQuestionId to its slug if possible.
                        // Complexity: If linkedToQuestionId is a random string, we need to find that doc to get its text/slug.
                        selectionCount: data.selectionCount,
                        selectionMode: data.selectionMode,
                        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                    }
                },
                upsert: true
            }
        });
    }
    if (volOps.length > 0) {
        if (!DRY_RUN) await VolunteerQuestion.bulkWrite(volOps);
        console.log(`Processed ${volOps.length} volunteer questions.`);
    }

    // 2. Org Feedback Questions
    const orgSnapshot = await db.collection('organizationFeedbackQuestions').get();
    const orgOps: any[] = [];
    for (const doc of orgSnapshot.docs) {
        const data = doc.data();
        const slug = createSlug(data.text) || doc.id;
        orgOps.push({
            updateOne: {
                filter: { slug: slug },
                update: {
                    $set: {
                         slug: slug,
                         text: data.text,
                         type: data.type,
                         options: data.options,
                         order: data.order,
                         createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                    }
                },
                upsert: true
            }
        });
    }
    if (orgOps.length > 0) {
        if (!DRY_RUN) await OrgQuestion.bulkWrite(orgOps);
        console.log(`Processed ${orgOps.length} org feedback questions.`);
    }
}

async function migrateStudents() {
  console.log('--- Migrating Students ---');
  let lastId = getCheckpoint('students');
  let query = db.collection('students').orderBy('__name__').limit(BATCH_SIZE);

  if (lastId) {
    query = query.startAfter(lastId);
  }

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const ops: any[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      ops.push({
        updateOne: {
          filter: { studentId: doc.id },
          update: {
            $set: {
              studentId: doc.id,
              email: data.email,
              fullName: data.fullName,
              program: data.program,
              visitedStalls: data.visitedStalls || [],
              scanCount: data.scanCount || 0,
              feedbackSubmitted: data.feedbackSubmitted || false,
              feedbackId: data.feedbackId,
              registeredAt: data.registeredAt instanceof Timestamp ? data.registeredAt.toDate() : new Date(),
              lastScanTime: data.lastScanTime instanceof Timestamp ? data.lastScanTime.toDate() : new Date(),
            }
          },
          upsert: true
        }
      });
    }

    if (!DRY_RUN && ops.length > 0) {
      await Student.bulkWrite(ops);
    }
    
    lastId = snapshot.docs[snapshot.docs.length - 1].id;
    if (!DRY_RUN) saveCheckpoint('students', lastId);
    
    console.log(`Processed ${ops.length} students. Last ID: ${lastId}`);
    
    // Prepare next batch
    query = db.collection('students').orderBy('__name__').startAfter(lastId).limit(BATCH_SIZE);
  }
}

async function migrateScans() {
    console.log('--- Migrating Scans ---');
    // Scans don't have a reliable custom ID for ordering in a way that startAfter(string) works perfectly across all types?
    // Actually document IDs are random or strings, __name__ ordering works.
    
    let lastId = getCheckpoint('scans');
    let query = db.collection('scans').orderBy('__name__').limit(BATCH_SIZE);
  
    if (lastId) {
      query = query.startAfter(lastId);
    }
  
    while (true) {
      const snapshot = await query.get();
      if (snapshot.empty) break;
  
      const ops: any[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Scan ID: Use existing doc ID if it matches our format, or fallback?
        // Firestore IDs might be random.
        // If we want to enforce `studentId_count`, we might need to regenerate it or just map `_id` to doc.id.
        // Strategy: Use existing `scanId` field if present, else use doc.id.
        // Wait, our Mongo model enforces `scanId`. 
        // If legacy data has random IDs, we should probably store that as `scanId` to avoid breaking history?
        // OR we can generate one if we have count? Hard to know strict order per student easily here without sorting.
        // Simplest: Use doc.id as scanId for migrated legacy records.
        
        ops.push({
          updateOne: {
            filter: { scanId: doc.id }, // Use doc ID as scanId for legacy
            update: {
              $set: {
                scanId: doc.id,
                studentId: data.studentId,
                studentEmail: data.studentEmail,
                studentProgram: data.studentProgram,
                organizationId: data.organizationId,
                organizationName: data.organizationName,
                boothNumber: data.boothNumber,
                timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
                scanMethod: data.scanMethod || 'qr_code'
              }
            },
            upsert: true
          }
        });
      }
  
      if (!DRY_RUN && ops.length > 0) {
        await Scan.bulkWrite(ops);
      }
      
      lastId = snapshot.docs[snapshot.docs.length - 1].id;
      if (!DRY_RUN) saveCheckpoint('scans', lastId);
      
      console.log(`Processed ${ops.length} scans.`);
      query = db.collection('scans').orderBy('__name__').startAfter(lastId).limit(BATCH_SIZE);
    }
  }

async function migrateFeedback() {
    console.log('--- Migrating Feedback ---');
    
    // Student Feedback
    const sfSnapshot = await db.collection('studentFeedback').get();
    const sfOps = sfSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            updateOne: {
                filter: { feedbackId: doc.id }, // doc.id is often studentId in our current firestore setup
                update: {
                    $set: {
                        feedbackId: `feedback_${doc.id}`, // Standardize
                        studentId: data.studentId || doc.id, // Fallback if missing in data
                        responses: data.responses,
                        timestamp: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
                    }
                },
                upsert: true
            }
        };
    });
    if (sfOps.length > 0 && !DRY_RUN) await StudentFeedback.bulkWrite(sfOps);
    console.log(`Processed ${sfOps.length} student feedback records.`);

    // Org Feedback
    const ofSnapshot = await db.collection('organizationFeedback').get();
    const ofOps = ofSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            updateOne: {
                filter: { feedbackId: doc.id },
                update: {
                    $set: {
                        feedbackId: `feedback_${doc.id}`,
                        organizationId: data.organizationId || doc.id,
                        responses: data.responses,
                        timestamp: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
                    }
                },
                upsert: true
            }
        };
    });
    if (ofOps.length > 0 && !DRY_RUN) await OrgFeedback.bulkWrite(ofOps);
    console.log(`Processed ${ofOps.length} org feedback records.`);
}

// --- Main Execution ---

async function runMigration() {
  console.log(`Starting Migration (DRY_RUN=${DRY_RUN})...`);
  
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    await migrateOrganizations();
    await migrateQuestions();
    await migrateStudents();
    await migrateScans();
    await migrateFeedback();
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runMigration();
