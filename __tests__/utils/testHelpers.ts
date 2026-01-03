/**
 * Test Helpers and Utilities for MongoDB Server Action Tests
 * Phase 6: Testing & Validation
 */

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// In-memory MongoDB replica set for tests (needed for transaction support)
let mongoReplSet: MongoMemoryReplSet | null = null;

/**
 * Connect to in-memory MongoDB replica set for testing (supports transactions)
 */
export async function connectTestDB(): Promise<void> {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const mongoUri = mongoReplSet.getUri();

  await mongoose.connect(mongoUri);
}

/**
 * Disconnect and cleanup test database
 */
export async function disconnectTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoReplSet) {
    await mongoReplSet.stop();
    mongoReplSet = null;
  }
}

/**
 * Clear all collections between tests
 */
export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Test Data Factories
 */
export const TestDataFactory = {
  /**
   * Generate a valid student ID
   */
  studentId: (prefix = 'ab') => `${prefix}${String(Math.floor(10000 + Math.random() * 90000))}`,

  /**
   * Generate a student object
   */
  student: (overrides = {}) => ({
    studentId: TestDataFactory.studentId(),
    email: `test${Date.now()}@example.com`,
    fullName: 'Test Student',
    visitedStalls: [],
    scanCount: 0,
    feedbackSubmitted: false,
    registeredAt: new Date(),
    lastScanTime: new Date(),
    ...overrides,
  }),

  /**
   * Generate an organization object
   */
  organization: (overrides = {}) => ({
    organizationId: `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Organization',
    industry: 'Technology',
    boothNumber: 'A1',
    qrCode: `qr-${Date.now()}`,
    contactPerson: 'John Doe',
    email: 'contact@test.org',
    category: 'Technology',
    visitors: [],
    visitorCount: 0,
    ...overrides,
  }),

  /**
   * Generate a scan object
   */
  scan: (studentId: string, organizationId: string, overrides = {}) => ({
    scanId: `${studentId}_${Date.now()}`,
    studentId,
    studentEmail: `${studentId}@test.edu`,
    organizationId,
    organizationName: 'Test Org',
    boothNumber: 'A1',
    timestamp: new Date(),
    scanMethod: 'qr_code' as const,
    ...overrides,
  }),

  /**
   * Generate a volunteer question object
   */
  volunteerQuestion: (overrides = {}) => ({
    text: `Test Question ${Date.now()}`,
    type: 'text' as const,
    order: 1,
    ...overrides,
  }),

  /**
   * Generate an organization feedback question object
   */
  orgQuestion: (overrides = {}) => ({
    text: `Org Question ${Date.now()}`,
    type: 'range' as const,
    minLabel: 'Poor',
    maxLabel: 'Excellent',
    scaleMax: 5,
    order: 1,
    ...overrides,
  }),

  /**
   * Generate feedback responses
   */
  feedbackResponses: () => ({
    'how-was-your-experience': '5',
    'would-you-recommend': 'Yes',
    'additional-comments': 'Great event!',
  }),
};

/**
 * Slug generation helper (mirrors the one in actions/questions.ts)
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Concurrent execution helper for load testing
 */
export async function runConcurrently<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 10
): Promise<{ results: T[]; errors: Error[] }> {
  const results: T[] = [];
  const errors: Error[] = [];
  
  const chunks: (() => Promise<T>)[][] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    chunks.push(tasks.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(chunk.map(task => task()));
    
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(result.reason);
      }
    }
  }

  return { results, errors };
}

/**
 * Performance measurement helper
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}
