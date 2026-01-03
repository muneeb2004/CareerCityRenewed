# Migration Strategy: Firebase Firestore to MongoDB

## Executive Summary
This document outlines the robust, stage-wise strategy to migrate the Career City 2026 application from a client-side Firebase Firestore architecture to a server-side MongoDB architecture using Mongoose and Next.js Server Actions.

**Key Objectives:**
1.  **Preserve Data Integrity:** Maintain custom ID structures (slugs for questions, `${studentId}_${count}` for scans) and relational links.
2.  **Atomic Operations:** Replicate Firestore transactions (e.g., `recordVisit`) using MongoDB Sessions.
3.  **Type Safety:** leverage Mongoose schemas to strictly enforce the TypeScript interfaces defined in `src/types`.
4.  **Zero Data Loss:** Implement a verification-first migration script.

---

## Phase 1: Infrastructure & Setup

**Goal:** Establish the MongoDB environment without affecting the running Firebase application.

### 1.1 Dependencies
*   **Action:** Install MongoDB driver and ODM.
    ```bash
    npm install mongoose mongodb
    npm install --save-dev @types/mongoose
    ```
*   **Action:** Uninstall Firebase (only after Phase 5 is complete).

### 1.2 Environment Configuration
*   **Action:** Update `.env.local` with MongoDB credentials.
    ```env
    MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/careercity?retryWrites=true&w=majority
    ```

### 1.3 Database Connection Handler
*   **File:** `src/lib/db.ts`
*   **Strategy:** Implement a singleton connection pattern to handle Next.js hot-reloading (caching the connection across invokations).

---

## Phase 2: Schema Design & Data Modeling

**Goal:** Translate flexible Firestore documents into strict Mongoose Schemas.
**Crucial:** We will use `_id` fields explicitly to store our custom strings (slugs, student IDs) instead of letting Mongo generate ObjectIds. This ensures backward compatibility with existing URLs and logic.

### 2.1 Models Directory
Create `src/models/` and implement the following schemas:

*   **Student Model (`Student.ts`)**
    *   `_id`: String (mapped from `studentId`)
    *   `visitedStalls`: Array of Strings (Organization IDs)
    *   `scanCount`: Number
    *   `timestamps`: true (Map Firestore `createdAt` to `createdAt`)

*   **Scan Model (`Scan.ts`)**
    *   `_id`: String (Format: `${studentId}_${scanCount}`)
    *   `studentId`: String (Indexed)
    *   `organizationId`: String (Indexed)
    *   `timestamp`: Date

*   **Question Models (`VolunteerQuestion.ts`, `OrgQuestion.ts`)**
    *   `_id`: String (The slugified text, e.g., "how-was-your-day")
    *   `text`: String
    *   `type`: String (Enum)
    *   `linkedToQuestionId`: String (Refers to another `_id`)

*   **Feedback Models**
    *   `responses`: Map/Object (Store the transformed key-value pairs)

---

## Phase 3: Data Access Layer (Server Actions)

**Goal:** Replace Client-side Firestore functions (`src/firestore/*.ts`) with Secure Server Actions (`src/actions/*.ts`).

### 3.1 Migration of Logic
We will create a parallel directory `src/actions/` to replicate logic.

| Firestore Function | Server Action Equivalent | Implementation Note |
| :--- | :--- | :--- |
| `scans.ts` -> `recordVisit` | `actions/scan.ts` -> `recordVisit` | **Must use `mongoose.startSession()`** to wrap updates to Student, Organization, and Scan creation in a single transaction. |
| `student.ts` -> `createStudent` | `actions/student.ts` -> `registerStudent` | Use `Model.create()` with `{ _id: studentId }`. |
| `volunteerQuestions.ts` | `actions/questions.ts` | Implement the **Slugify** logic here before saving to `_id`. |
| `getDocs` queries | `actions/*.ts` -> `get...` | Use `.lean()` for performance when returning plain objects to Client Components. |

### 3.2 Transaction Replication
The `recordVisit` transaction is critical.
**MongoDB Strategy:**
1.  `session.startTransaction()`
2.  `Student.findOne().session(session)`
3.  Check constraints (already visited?).
4.  `Scan.create([data], { session })`
5.  `Student.updateOne(..., { $inc: { scanCount: 1 } }).session(session)`
6.  `Organization.updateOne(..., { $inc: { visitorCount: 1 } }).session(session)`
7.  `session.commitTransaction()`

---

## Phase 4: Data Migration Script

**Goal:** Move existing production data from Firestore to MongoDB.

### 4.1 Script Structure (`scripts/migrate-firestore-mongo.ts`)
A standalone script using `firebase-admin` and `mongoose`.

### 4.2 Migration Steps (in order):
1.  **Organizations:** Fetch all -> Insert into Mongo (preserve IDs).
2.  **Students:** Fetch all -> Convert `Timestamp` to `Date` -> Insert.
3.  **Questions:** Fetch all -> Ensure IDs are slugs (if not, slugify them during migration and create a mapping map).
4.  **Scans:** Fetch all -> Insert.
    *   *Constraint Check:* Verify `studentId` and `organizationId` exist in Mongo before inserting.
5.  **Feedback:** Migrate responses.

---

## Phase 5: UI Integration (Cutover)

**Goal:** Switch the frontend to use the new Server Actions.

### 5.1 Refactoring Components
*   **`StudentRegistration.tsx`**: Replace `createStudent` import with `registerStudent` server action.
*   **`QRScanner.tsx`**: Update the `onScan` callback to call the `recordVisit` server action.
*   **`FeedbackForm.tsx`**: Update submission logic to call `submitFeedback` server action.

### 5.2 Data Fetching
*   Convert Client Components doing data fetching (e.g., `useEffect(() => getScans...)`) to rely on Server Actions or pass data down from Server Component parents (Pages).

---

## Phase 6: Verification & Cleanup

### 6.1 Testing
1.  **Unit Tests:** Create `__tests__/actions/*.test.ts` mirroring the Firestore tests we created (verifying Slugs, Transactions).
2.  **Integration Test:** Run a full flow: Register Student -> Scan QR -> Submit Feedback -> Verify MongoDB records.

### 6.2 Cleanup
1.  Remove `src/firestore/` directory.
2.  Remove `firebase` dependency.
3.  Remove `firebase.ts` config.

---

## Execution Checklist

- [ ] **Phase 1:** Install `mongoose`, setup `lib/db.ts`.
- [ ] **Phase 2:** Create Schemas in `src/models/`.
- [ ] **Phase 3:** Create Server Actions in `src/actions/` (replicating logic).
- [ ] **Phase 4:** Run Migration Script (dry run first).
- [ ] **Phase 5:** Refactor `app/student/page.tsx` and `StudentRegistration.tsx` to use Actions.
- [ ] **Phase 6:** Run Tests & Decommission Firestore.
