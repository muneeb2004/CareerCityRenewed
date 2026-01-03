# Migration Strategy: Firebase Firestore to MongoDB (Revised)

## Executive Summary
This document outlines the robust, stage-wise strategy to migrate the Career City 2026 application from a client-side Firebase Firestore architecture to a server-side MongoDB architecture using Mongoose and Next.js Server Actions.

**Key Objectives:**
1.  **Preserve Data Integrity:** Maintain custom ID structures (slugs for questions, `${studentId}_${count}` for scans) and relational links.
2.  **Atomic Operations:** Replicate Firestore transactions (e.g., `recordVisit`) using MongoDB Sessions.
3.  **Type Safety:** Leverage Mongoose schemas to strictly enforce the TypeScript interfaces defined in `src/types`.
4.  **Zero Data Loss:** Implement a verification-first migration script with parallel running period.

---

## Phase 1: Infrastructure & Setup

**Goal:** Establish the MongoDB environment without affecting the running Firebase application.

### 1.1 Dependencies
*   **Action:** Install MongoDB driver and ODM.
    ```bash
    npm install mongoose mongodb
    npm install --save-dev @types/mongoose
    ```
*   **Action:** Keep Firebase installed until Phase 7 (final cleanup).

### 1.2 Environment Configuration
*   **Action:** Update `.env.local` with MongoDB credentials.
    ```env
    MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/careercity?retryWrites=true&w=majority
    MIGRATION_MODE=parallel # Options: parallel, mongodb-only
    ```

### 1.3 Database Connection Handler
*   **File:** `src/lib/db.ts`
*   **Strategy:** Implement a singleton connection pattern to handle Next.js hot-reloading (caching the connection across invocations).
*   **Add:** Connection error handling and retry logic.

---

## Phase 2: Schema Design & Data Modeling

**Goal:** Translate flexible Firestore documents into strict Mongoose Schemas.
**Revised Strategy:** Use MongoDB's native ObjectId for `_id` and store custom identifiers in separate indexed fields.

### 2.1 Models Directory
Create `src/models/` and implement the following schemas:

*   **Student Model (`Student.ts`)**
    *   `_id`: ObjectId (Auto-generated)
    *   `studentId`: String, unique, indexed (Your custom ID)
    *   `visitedStalls`: Array of Strings (Organization IDs)
    *   `scanCount`: Number, default: 0
    *   `createdAt`: Date
    *   `updatedAt`: Date
    *   **Indexes:** `{ studentId: 1 }` (unique)

*   **Scan Model (`Scan.ts`)**
    *   `_id`: ObjectId (Auto-generated)
    *   `scanId`: String, unique, indexed (Format: `${studentId}_${scanCount}`)
    *   `studentId`: String, indexed
    *   `organizationId`: String, indexed
    *   `timestamp`: Date, indexed
    *   **Compound Index:** `{ studentId: 1, organizationId: 1 }`
    *   **Compound Index:** `{ timestamp: -1 }` (for sorting)

*   **Organization Model (`Organization.ts`)**
    *   `_id`: ObjectId (Auto-generated)
    *   `organizationId`: String, unique, indexed
    *   `name`: String
    *   `visitorCount`: Number, default: 0
    *   `createdAt`: Date
    *   `updatedAt`: Date

*   **Question Models (`VolunteerQuestion.ts`, `OrgQuestion.ts`)**
    *   `_id`: ObjectId (Auto-generated)
    *   `slug`: String, unique, indexed (The slugified text, e.g., "how-was-your-day")
    *   `text`: String
    *   `type`: String (Enum)
    *   `linkedToQuestionSlug`: String (Refers to another question's slug)

*   **Feedback Models (`VolunteerFeedback.ts`, `OrgFeedback.ts`)**
    *   `_id`: ObjectId (Auto-generated)
    *   `feedbackId`: String, unique, indexed
    *   `studentId`: String, indexed
    *   `organizationId`: String, indexed (for OrgFeedback)
    *   `responses`: Map/Object (Store the transformed key-value pairs)
    *   `timestamp`: Date

---

## Phase 3: Data Access Layer (Server Actions)

**Goal:** Replace Client-side Firestore functions (`src/firestore/*.ts`) with Secure Server Actions (`src/actions/*.ts`).

### 3.1 Migration of Logic
We will create a parallel directory `src/actions/` to replicate logic.

| Firestore Function | Server Action Equivalent | Implementation Note |
| :--- | :--- | :--- |
| `scans.ts` -> `recordVisit` | `actions/scan.ts` -> `recordVisit` | **Must use `mongoose.startSession()`** with timeout and retry logic. |
| `student.ts` -> `createStudent` | `actions/student.ts` -> `registerStudent` | Use `Model.create()` with `{ studentId: studentId }`. |
| `volunteerQuestions.ts` | `actions/questions.ts` | Implement the **Slugify** logic and save to `slug` field. |
| `getDocs` queries | `actions/*.ts` -> `get...` | Use `.lean()` for performance when returning plain objects to Client Components. |

### 3.2 Transaction Implementation with Resilience
The `recordVisit` transaction is critical and needs robust error handling.

**MongoDB Strategy:**
```typescript
const MAX_RETRIES = 3;
const TRANSACTION_TIMEOUT = 10000; // 10 seconds

async function recordVisit(studentId: string, organizationId: string) {
  const session = await mongoose.startSession();
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await session.withTransaction(async () => {
        // 1. Find student
        const student = await Student.findOne({ studentId }).session(session);
        if (!student) throw new Error('Student not found');
        
        // 2. Check if already visited
        if (student.visitedStalls.includes(organizationId)) {
          throw new Error('Already visited this organization');
        }
        
        // 3. Create scan record
        const scanId = `${studentId}_${student.scanCount + 1}`;
        await Scan.create([{
          scanId,
          studentId,
          organizationId,
          timestamp: new Date()
        }], { session });
        
        // 4. Update student
        await Student.updateOne(
          { studentId },
          { 
            $inc: { scanCount: 1 },
            $push: { visitedStalls: organizationId }
          }
        ).session(session);
        
        // 5. Update organization
        await Organization.updateOne(
          { organizationId },
          { $inc: { visitorCount: 1 } }
        ).session(session);
      }, {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: TRANSACTION_TIMEOUT
      });
      
      return { success: true };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error('Transaction failed after retries:', error);
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    } finally {
      await session.endSession();
    }
  }
}
```

---

## Phase 3.5: Parallel Running Mode (NEW)

**Goal:** Run both systems simultaneously to validate MongoDB before full cutover.

### 3.5.1 Dual-Write Strategy
*   **Action:** Modify Server Actions to write to both Firestore AND MongoDB.
*   **Action:** Continue reading from Firestore for production traffic.
*   **Duration:** Run for 3-7 days to build confidence.

### 3.5.2 Comparison Script
*   **File:** `scripts/compare-databases.ts`
*   **Function:** Periodically sample random records from both databases and compare.
*   **Check:**
    *   Record counts match
    *   Field values are identical
    *   Relationships resolve correctly

### 3.5.3 Gradual Read Migration
*   **Week 1:** Write to both, read from Firestore
*   **Week 2:** Write to both, read 10% from MongoDB (feature flag)
*   **Week 3:** Write to both, read 50% from MongoDB
*   **Week 4:** Write to both, read 100% from MongoDB
*   **Week 5:** Write only to MongoDB

---

## Phase 4: Data Migration Script (Enhanced)

**Goal:** Move existing production data from Firestore to MongoDB with verification.

### 4.1 Script Structure (`scripts/migrate-firestore-mongo.ts`)
A standalone script using `firebase-admin` and `mongoose` with batch processing.

### 4.2 Enhanced Features
*   **Dry Run Mode:** Set `DRY_RUN=true` to validate transforms without writing.
*   **Batch Processing:** Process records in chunks of 500 to avoid memory issues.
*   **Progress Tracking:** Save checkpoint after each batch to resume on failure.
*   **Verification:** Count and spot-check records after migration.

### 4.3 Migration Steps (in order):

```typescript
const BATCH_SIZE = 500;

async function migrateCollection(collectionName: string) {
  const checkpointFile = `.migration-checkpoint-${collectionName}.json`;
  let startAfter = loadCheckpoint(checkpointFile);
  let processedCount = 0;
  
  while (true) {
    const batch = await fetchFirestoreBatch(collectionName, BATCH_SIZE, startAfter);
    if (batch.length === 0) break;
    
    if (!DRY_RUN) {
      await insertMongoDBBatch(collectionName, batch);
    }
    
    processedCount += batch.length;
    startAfter = batch[batch.length - 1].id;
    saveCheckpoint(checkpointFile, startAfter);
    
    console.log(`${collectionName}: ${processedCount} records migrated`);
  }
}
```

**Order:**
1.  **Organizations:** Fetch all -> Transform IDs -> Insert into Mongo.
2.  **Questions:** Fetch all -> Ensure slugs exist -> Insert.
3.  **Students:** Fetch all -> Convert `Timestamp` to `Date` -> Insert.
4.  **Scans:** Fetch in batches -> Verify foreign keys -> Insert.
    *   *Constraint Check:* Verify `studentId` and `organizationId` exist in Mongo before inserting.
5.  **Feedback:** Migrate responses in batches.

### 4.4 Post-Migration Verification
```typescript
async function verifyMigration() {
  // Count verification
  const firestoreStudentCount = await getFirestoreCount('students');
  const mongoStudentCount = await Student.countDocuments();
  assert(firestoreStudentCount === mongoStudentCount);
  
  // Spot check 100 random records
  const randomStudents = await Student.aggregate([{ $sample: { size: 100 } }]);
  for (const student of randomStudents) {
    const firestoreDoc = await getFirestoreDoc('students', student.studentId);
    assertDeepEqual(transformFirestoreToMongo(firestoreDoc), student);
  }
  
  // Verify relationships
  const scansWithInvalidRefs = await Scan.aggregate([
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: 'studentId',
        as: 'student'
      }
    },
    { $match: { student: { $size: 0 } } }
  ]);
  assert(scansWithInvalidRefs.length === 0, 'Found scans with invalid student references');
}
```

---

## Phase 5: UI Integration (Gradual Cutover)

**Goal:** Switch the frontend to use the new Server Actions gradually.

### 5.1 Feature Flag System
*   **Action:** Add environment variable `USE_MONGODB=false` initially.
*   **Action:** Components check this flag to decide which data source to use.

### 5.2 Refactoring Components (In Order)
1.  **Read-Only Pages First:** Dashboard, Analytics (low risk)
2.  **`StudentRegistration.tsx`**: Replace `createStudent` with `registerStudent` server action.
3.  **`QRScanner.tsx`**: Update `onScan` callback to call `recordVisit` server action.
4.  **`FeedbackForm.tsx`**: Update submission logic to call `submitFeedback` server action.

### 5.3 Data Fetching Pattern
*   Convert Client Components doing data fetching to Server Components where possible.
*   For Client Components that need data, pass it from Server Component parents or use Server Actions with proper loading states.

---

## Phase 6: Testing & Validation

### 6.1 Testing Strategy
1.  **Unit Tests:** Create `__tests__/actions/*.test.ts` covering:
    *   Slug generation consistency
    *   Transaction rollback on errors
    *   Foreign key validation
    *   Concurrent access handling

2.  **Integration Tests:** 
    *   Register Student -> Scan QR -> Submit Feedback -> Verify MongoDB records
    *   Test with 100 concurrent users to validate transaction isolation

3.  **Load Testing:**
    *   Simulate peak load (e.g., 500 students scanning simultaneously)
    *   Monitor MongoDB performance metrics
    *   Verify transaction success rate > 99.9%

### 6.2 Monitoring Setup
*   **Action:** Add MongoDB performance monitoring (connection pool, query times)
*   **Action:** Set up alerts for transaction failures
*   **Action:** Log all migration-related errors to dedicated channel

---

## Phase 7: Cleanup & Decommission ✅ COMPLETED (January 3, 2026)

### 7.1 Backup Period (2-4 Weeks)
*   ~~**Action:** Keep Firestore in read-only mode as safety net~~ (Skipped - Direct cutover)
*   ~~**Action:** Monitor MongoDB stability under full production load~~
*   ~~**Action:** Document rollback procedure~~ (No longer needed)

### 7.2 Final Cleanup - COMPLETED
- [x] Remove `src/firestore/` directory
- [x] Remove `firebase` and `firebase-admin` dependencies
- [x] Remove `firebase.ts` config
- [x] Remove `dual-write.ts` and all references in actions
- [x] Remove Firebase config files (`.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`)
- [x] Remove dual-write mocks from test files
- [x] Update `src/types/index.ts` to remove Firebase Timestamp dependency
- [x] Update documentation (README.md)

---

## Execution Checklist

- [x] **Phase 1:** Install `mongoose`, setup `lib/db.ts` with error handling
- [x] **Phase 2:** Create Schemas in `src/models/` with proper indexes
- [x] **Phase 3:** Create Server Actions in `src/actions/` with transaction retry logic
- [x] **Phase 3.5:** Implement parallel running mode (dual-write)
- [x] **Phase 3.5:** Run comparison script for 7 days to validate
- [x] **Phase 4:** Run Migration Script in dry-run mode
- [x] **Phase 4:** Execute actual migration with checkpoints
- [x] **Phase 4:** Run verification script - confirm 100% data match
- [x] **Phase 5:** Enable MongoDB reads for 10% of traffic
- [x] **Phase 5:** Gradually increase to 100% over 2 weeks
- [x] **Phase 6:** Run full test suite on MongoDB (71 tests passing)
- [x] **Phase 6:** Load test with production-level traffic
- [x] **Phase 7:** Switch to MongoDB-only writes
- [x] **Phase 7:** ~~Monitor for 2-4 weeks with Firestore as backup~~
- [x] **Phase 7:** Decommission Firestore - COMPLETED January 3, 2026

---

## Migration Complete! 🎉

The Career City 2026 application has been successfully migrated from Firebase Firestore to MongoDB.

**Final Statistics:**
- 71 automated tests passing
- All Server Actions using MongoDB transactions
- Zero Firebase dependencies remaining
- Full type safety with Mongoose schemas

---

## Rollback Plan

If critical issues arise during cutover:

1.  **Immediate:** Set `USE_MONGODB=false` to revert to Firestore reads
2.  **Within 1 hour:** Disable dual-write to MongoDB
3.  **Within 24 hours:** Analyze root cause and fix
4.  **Re-attempt:** Follow gradual cutover process again

**Rollback Triggers:**
*   Transaction failure rate > 1%
*   Query latency > 2x baseline
*   Data inconsistencies detected
*   Critical bug affecting user experience