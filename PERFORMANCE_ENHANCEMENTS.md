# Top 15 Coding Practices for High-Performance & Scalability

This document serves as the **single source of truth** for all performance optimizations in the Career City 2026 project. It covers Backend, Database, and Frontend strategies.

---

## 1. Use Lean Queries (Remove Unused Data)

**Problem:** By default, Mongoose returns full documents with all fields and Mongoose metadata, wasting memory and bandwidth.

**Solution:** Use `.lean()` for read-only operations and `.select()` to fetch only needed fields.

```typescript
// ❌ BAD - Returns full document with Mongoose overhead
const students = await Student.find({ visitedStalls: orgId });

// ✅ GOOD - Returns plain JavaScript object, 50% faster
const students = await Student.find({ visitedStalls: orgId }).lean();

// ✅ EVEN BETTER - Only fetch what you need
const students = await Student
  .find({ visitedStalls: orgId })
  .select('studentId scanCount') // Only these fields
  .lean();
```

**Impact:** 40-60% reduction in memory usage and response time.

---

## 2. Create Strategic Database Indexes

**Problem:** Without indexes, MongoDB scans every document. With 10,000 students, a query becomes 100x slower.

**Solution:** Index your most-queried fields.

```typescript
// src/models/Student.ts
const studentSchema = new Schema({
  studentId: { type: String, required: true, unique: true, index: true },
  visitedStalls: [{ type: String, index: true }],
  scanCount: Number,
}, {
  timestamps: true
});

// Compound index for common queries
studentSchema.index({ studentId: 1, scanCount: -1 });

// src/models/Scan.ts
const scanSchema = new Schema({
  scanId: { type: String, required: true, unique: true },
  studentId: { type: String, required: true, index: true },
  organizationId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
});

// Compound indexes for analytics queries
scanSchema.index({ organizationId: 1, timestamp: -1 });
scanSchema.index({ studentId: 1, timestamp: -1 });
```

**Check which indexes to add:**
```javascript
// Run this in MongoDB shell to see slow queries
db.scans.find({ studentId: "STU123" }).explain("executionStats")
// Look for "COLLSCAN" (bad) vs "IXSCAN" (good)
```

**Impact:** 10-100x faster queries.

---

## 3. Implement Connection Pooling

**Problem:** Creating new database connections is expensive (100-500ms each). Serverless functions do this repeatedly.

**Solution:** Configure proper connection pooling and reuse connections.

```typescript
// src/lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 50,        // Allow up to 50 concurrent connections
      minPoolSize: 10,        // Keep 10 connections always ready
      maxIdleTimeMS: 10000,   // Close idle connections after 10s
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;

declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}
```

**Impact:** 80% reduction in connection overhead.

---

## 4. Add Response Caching for Read-Heavy Data

**Problem:** Fetching organization lists or questions repeatedly wastes database resources.

**Solution:** Cache static or rarely-changing data.

```typescript
// src/lib/cache.ts
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

export function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}
```

**Impact:** 90% reduction in database reads for static data.

---

## 5. Batch Operations Instead of Loops

**Problem:** Making 100 database calls in a loop is 50x slower than one batch operation.

**Solution:** Use bulk operations.

```typescript
// ❌ BAD - Makes 100 separate database calls
for (const studentId of studentIds) {
  await Student.updateOne({ studentId }, { $set: { verified: true } });
}

// ✅ GOOD - Single batch operation
await Student.updateMany(
  { studentId: { $in: studentIds } },
  { $set: { verified: true } }
);
```

**Impact:** 10-50x faster for batch operations.

---

## 6. Implement Proper Error Handling with Circuit Breaker

**Problem:** When the database is overloaded, every request keeps trying and makes it worse.

**Solution:** Implement circuit breaker pattern to fail fast.

```typescript
// Conceptual Implementation
class CircuitBreaker {
  // ... (implementation logic)
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) throw new Error('Service unavailable');
    // ... try/catch logic
  }
}
```

**Impact:** Prevents cascade failures during high load.

---

## 7. Optimize Transaction Scope (Keep It Minimal)

**Problem:** Long-running transactions lock resources and reduce throughput.

**Solution:** Only include essential operations in transactions. Do not include external API calls or non-critical reads.

**Impact:** 3-5x higher transaction throughput.

---

## 8. Add Request Deduplication

**Problem:** Users double-clicking or network retries can create duplicate scans.

**Solution:** Implement idempotency keys using a simple `Map` or Redis.

**Impact:** Prevents duplicate operations during high traffic.

---

## 9. Implement Rate Limiting

**Problem:** A single user or bot can overwhelm your system.

**Solution:** Add rate limiting per user/IP.

**Impact:** Protects system from abuse.

---

## 10. Use Streaming for Large Responses

**Problem:** Loading 10,000 scans into memory crashes serverless functions.

**Solution:** Stream data in chunks or use pagination/cursors.

**Impact:** Handle datasets 100x larger without memory issues.

---

## 11. Implement Dynamic Imports & Code Splitting

**Problem:** `package.json` includes heavy libraries like `@zxing/library` (scanning) and `recharts` (charts). Loading these on the initial page load significantly hurts performance.

**Solution:** Lazy load heavy components so they only download when needed.

```tsx
// ❌ BAD - Imports scanner immediately, even if user is just logging in
import QRScanner from '@/components/student/QRScanner';

// ✅ GOOD - Loads scanner code only when component renders
import dynamic from 'next/dynamic';

const QRScanner = dynamic(() => import('@/components/student/QRScanner'), {
  loading: () => <p>Loading Camera...</p>,
  ssr: false // Scanner relies on browser APIs anyway
});
```

**Impact:** Faster First Contentful Paint (FCP) and lower bandwidth usage.

---

## 12. Use Optimistic UI Updates

**Problem:** Waiting for the server to respond before showing a "Success" tick feels sluggish on slow networks.

**Solution:** Update the UI immediately, then sync with the server. If it fails, roll back.

```tsx
// Using Next.js 14 useOptimistic
const [optimisticScans, addOptimisticScan] = useOptimistic(
  scans,
  (state, newScan) => [newScan, ...state]
);

async function handleScan(data) {
  addOptimisticScan(data); // ⚡ Instant UI update
  await saveScanToServer(data); // Background sync
}
```

**Impact:** App feels "native" and instant regardless of network speed.

---

## 13. Leverage Next.js ISR (Incremental Static Regeneration)

**Problem:** Fetching organization lists on every request for every user is inefficient.

**Solution:** Use Next.js built-in ISR. It caches the HTML at the Edge (CDN).

```tsx
// src/app/staff/organizations/page.tsx
export const revalidate = 300; // Re-generate page every 5 minutes

export default async function Page() {
  const orgs = await db.Organization.find().lean(); // Runs only once per 5 mins
  return <OrgList orgs={orgs} />;
}
```

**Impact:** Reduces Server/DB hits to near-zero for static content.

---

## 14. Virtualize Long Lists

**Problem:** Rendering 500+ student rows in the DOM will freeze the browser.

**Solution:** Use `react-window` (already in `package.json`) for Student Records and Scan History tables to render only visible rows.

```tsx
import { FixedSizeList as List } from 'react-window';

const Row = ({ index, style }) => (
  <div style={style}>Student {students[index].name}</div>
);

<List height={500} itemCount={students.length} itemSize={35} width="100%">
  {Row}
</List>
```

**Impact:** Smooth scrolling and zero lag even with 10,000+ records.

---

## 15. Optimize Animations & Bundle Size

**Problem:** Complex animations can block user input and increase bundle size.

**Solution:** Use `LazyMotion` features from `framer-motion`.

```tsx
import { LazyMotion, domAnimation, m } from "framer-motion"

// Use 'm' instead of 'motion' and wrap app in LazyMotion
<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

**Impact:** Reduced JavaScript execution time and main thread blocking.

---

# Stage-Wise Implementation Plan

Follow this priority order to ensure maximum stability and performance impact.

## Stage 1: Critical Foundation (Backend Stability)
*Goal: Ensure the server doesn't crash under load.*
1.  **[x] Lean Queries:** Apply `.lean()` to all read operations in `src/actions/`.
2.  **[x] Database Indexes:** Verify and apply indexes in `src/models/` for `studentId`, `organizationId`, and timestamps.
3.  **[x] Connection Pooling:** Refine `src/lib/db.ts` to ensure connections are reused efficiently in serverless environment.
4.  **[x] Transaction Scope:** Review `src/actions/scans.ts` and ensure transactions are minimal and contain NO external calls.

## Stage 2: User Experience & Frontend Speed
*Goal: Make the app feel fast and responsive.*
1.  **[x] Dynamic Imports:** Refactor `QRScanner` and `Recharts` components to use `next/dynamic`.
2.  **[x] List Virtualization:** Implement `react-window` for the "Student Records" and any "Scan History" tables.
3.  **[x] ISR Implementation:** Add `export const revalidate = 300` to `src/app/staff/organizations/page.tsx` and public-facing static pages.

## Stage 3: Data Integrity & High-Volume Handling
*Goal: Handle concurrent users without data corruption.*
1.  **[x] Request Deduplication:** Implement the `isDuplicate` check in scan actions.
2.  **[x] Batch Operations:** Ensure any bulk uploads or updates use `insertMany` or `bulkWrite`.
3.  **[x] Optimistic UI:** Add optimistic state updates to the Scanning interface for immediate feedback.

## Stage 4: Protection, Scale & Polish
*Goal: Production hardening.*
1.  **[x] Rate Limiting:** Implement basic rate limiting (Memory or Redis) for scan endpoints.
2.  **[x] Circuit Breaker:** Add circuit breaker logic for database connections if timeouts persist.
3.  **[x] Animation Optimization:** Switch standard `motion` imports to `LazyMotion`.
4.  **[x] Bundle Analysis:** Run a build analysis to ensure no other large dependencies are leaking into the client bundle.