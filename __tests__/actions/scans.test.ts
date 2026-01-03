/**
 * Unit Tests for Scans Server Actions
 * Phase 6: Testing & Validation
 * @jest-environment node
 */

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Student } from '@/models/Student';
import { Scan } from '@/models/Scan';
import { Organization } from '@/models/Organization';
import { TestDataFactory, runConcurrently, measureTime } from '../utils/testHelpers';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock dbConnect
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(mongoose),
}));

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const mongoUri = mongoReplSet.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
}, 30000);

beforeEach(async () => {
  await Student.deleteMany({});
  await Scan.deleteMany({});
  await Organization.deleteMany({});
  jest.clearAllMocks();
});

describe('Scans Actions', () => {
  describe('recordVisit', () => {
    it('should record a visit successfully', async () => {
      // Setup student and organization
      const testOrg = TestDataFactory.organization();
      const testStudent = TestDataFactory.student({ 
        visitedStalls: [],
        scanCount: 0 
      });
      
      await Organization.create(testOrg);
      await Student.create(testStudent);

      const { recordVisit } = await import('@/actions/scans');

      // Execute
      const result = await recordVisit(
        testStudent.studentId,
        testStudent.email,
        'Computer Science',
        testOrg.organizationId,
        testOrg.name,
        testOrg.boothNumber
      );

      // Verify
      expect(result).toEqual({ success: true });

      // Verify student was updated
      const updatedStudent = await Student.findOne({ studentId: testStudent.studentId });
      expect(updatedStudent?.scanCount).toBe(1);
      expect(updatedStudent?.visitedStalls).toContain(testOrg.organizationId);

      // Verify scan was created
      const scan = await Scan.findOne({ studentId: testStudent.studentId });
      expect(scan).not.toBeNull();
      expect(scan?.scanId).toBe(`${testStudent.studentId}_1`);

      // Verify organization was updated
      const updatedOrg = await Organization.findOne({ organizationId: testOrg.organizationId });
      expect(updatedOrg?.visitorCount).toBe(1);
    });

    it('should throw error for non-existent student', async () => {
      const testOrg = TestDataFactory.organization();
      await Organization.create(testOrg);

      const { recordVisit } = await import('@/actions/scans');

      await expect(
        recordVisit(
          'nonexistent',
          'test@test.edu',
          'CS',
          testOrg.organizationId,
          testOrg.name,
          testOrg.boothNumber
        )
      ).rejects.toThrow('Student not found');
    });

    it('should prevent duplicate visits to same organization', async () => {
      const testOrg = TestDataFactory.organization();
      const testStudent = TestDataFactory.student({ 
        visitedStalls: [testOrg.organizationId], // Already visited
        scanCount: 1 
      });
      
      await Organization.create(testOrg);
      await Student.create(testStudent);

      const { recordVisit } = await import('@/actions/scans');

      await expect(
        recordVisit(
          testStudent.studentId,
          testStudent.email,
          'CS',
          testOrg.organizationId,
          testOrg.name,
          testOrg.boothNumber
        )
      ).rejects.toThrow('Already visited this organization');
    });

    it('should handle concurrent visits atomically', async () => {
      // Setup: one student, multiple organizations
      const testStudent = TestDataFactory.student({ 
        visitedStalls: [],
        scanCount: 0 
      });
      await Student.create(testStudent);

      const orgs = Array.from({ length: 5 }, () => TestDataFactory.organization());
      await Organization.create(orgs);

      const { recordVisit } = await import('@/actions/scans');

      // Execute concurrent visits
      const tasks = orgs.map(org => () => 
        recordVisit(
          testStudent.studentId,
          testStudent.email,
          'CS',
          org.organizationId,
          org.name,
          org.boothNumber
        )
      );

      const { results, errors } = await runConcurrently(tasks, 5);

      // All should succeed (no duplicates)
      expect(results).toHaveLength(5);
      expect(errors).toHaveLength(0);

      // Verify final state
      const updatedStudent = await Student.findOne({ studentId: testStudent.studentId });
      expect(updatedStudent?.scanCount).toBe(5);
      expect(updatedStudent?.visitedStalls).toHaveLength(5);
    });
  });

  describe('getScansByStudent', () => {
    it('should return all scans for a student', async () => {
      const studentId = TestDataFactory.studentId();
      const scans = [
        { ...TestDataFactory.scan(studentId, 'org1'), scanId: `${studentId}_1` },
        { ...TestDataFactory.scan(studentId, 'org2'), scanId: `${studentId}_2` },
      ];
      await Scan.create(scans);

      const { getScansByStudent } = await import('@/actions/scans');
      const result = await getScansByStudent(studentId);

      expect(result).toHaveLength(2);
    });

    it('should return empty array if no scans', async () => {
      const { getScansByStudent } = await import('@/actions/scans');
      const result = await getScansByStudent('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should return scans sorted by timestamp descending', async () => {
      const studentId = TestDataFactory.studentId();
      const now = new Date();
      const scans = [
        { 
          ...TestDataFactory.scan(studentId, 'org1'), 
          scanId: `${studentId}_1`,
          timestamp: new Date(now.getTime() - 3600000) // 1 hour ago
        },
        { 
          ...TestDataFactory.scan(studentId, 'org2'), 
          scanId: `${studentId}_2`,
          timestamp: now // Now
        },
      ];
      await Scan.create(scans);

      const { getScansByStudent } = await import('@/actions/scans');
      const result = await getScansByStudent(studentId);

      // Most recent should be first
      expect(result[0].scanId).toBe(`${studentId}_2`);
    });
  });

  describe('getAllScans', () => {
    it('should return all scans', async () => {
      const scan1 = TestDataFactory.scan('student1', 'org1');
      const scan2 = TestDataFactory.scan('student2', 'org2');
      await Scan.create([
        { ...scan1, scanId: 'scan1' },
        { ...scan2, scanId: 'scan2' }
      ]);

      const { getAllScans } = await import('@/actions/scans');
      const result = await getAllScans();

      expect(result).toHaveLength(2);
    });
  });

  describe('getScansByOrganization', () => {
    it('should return scans for specific organization', async () => {
      const orgId = 'target-org';
      await Scan.create([
        { ...TestDataFactory.scan('student1', orgId), scanId: 's1' },
        { ...TestDataFactory.scan('student2', orgId), scanId: 's2' },
        { ...TestDataFactory.scan('student3', 'other-org'), scanId: 's3' },
      ]);

      const { getScansByOrganization } = await import('@/actions/scans');
      const result = await getScansByOrganization(orgId);

      expect(result).toHaveLength(2);
      expect(result.every(s => s.organizationId === orgId)).toBe(true);
    });
  });
});

describe('Transaction Isolation Tests', () => {
  it('should maintain data consistency under concurrent modifications', async () => {
    // Setup
    const testOrg = TestDataFactory.organization({ visitorCount: 0 });
    await Organization.create(testOrg);

    // Create 10 students
    const students = Array.from({ length: 10 }, () => 
      TestDataFactory.student({ visitedStalls: [], scanCount: 0 })
    );
    await Student.create(students);

    const { recordVisit } = await import('@/actions/scans');

    // All students visit the same org concurrently
    const tasks = students.map(student => () =>
      recordVisit(
        student.studentId,
        student.email,
        'CS',
        testOrg.organizationId,
        testOrg.name,
        testOrg.boothNumber
      )
    );

    await runConcurrently(tasks, 10);

    // Verify organization visitor count is exactly 10
    const updatedOrg = await Organization.findOne({ organizationId: testOrg.organizationId });
    expect(updatedOrg?.visitorCount).toBe(10);
    expect(updatedOrg?.visitors).toHaveLength(10);
  });
});
