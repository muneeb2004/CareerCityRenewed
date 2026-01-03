/**
 * Integration Tests for Complete User Flows
 * Phase 6: Testing & Validation
 * @jest-environment node
 * 
 * Tests the full flow: Student Registration -> Visit Booths -> Submit Feedback
 */

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock dbConnect to use our test connection
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(mongoose),
}));

let mongoReplSet: MongoMemoryReplSet;
let Student: typeof import('@/models/Student').Student;
let Organization: typeof import('@/models/Organization').Organization;
let Scan: typeof import('@/models/Scan').Scan;
let StudentFeedback: typeof import('@/models/Feedback').StudentFeedback;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const mongoUri = mongoReplSet.getUri();
  await mongoose.connect(mongoUri);
  
  // Import models after connection
  const studentModule = await import('@/models/Student');
  Student = studentModule.Student;
  const orgModule = await import('@/models/Organization');
  Organization = orgModule.Organization;
  const scanModule = await import('@/models/Scan');
  Scan = scanModule.Scan;
  const feedbackModule = await import('@/models/Feedback');
  StudentFeedback = feedbackModule.StudentFeedback;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
}, 30000);

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.clearAllMocks();
});

describe('Complete Career Fair Flow', () => {
  it('should complete basic student journey: register → visit → feedback', async () => {
    // Step 1: Create an organization
    await Organization.create({
      organizationId: 'test-corp',
      name: 'Test Corporation',
      industry: 'Technology',
      boothNumber: 'A101',
      qrCode: 'qr-test-corp',
      contactPerson: 'Jane Manager',
      email: 'jane@testcorp.com',
      category: 'Technology',
      visitors: [],
      visitorCount: 0,
    });

    // Step 2: Student registers via createStudent action
    const { createStudent } = await import('@/actions/student');
    await createStudent(
      'FLOW-001',
      'flowtest@test.edu',
      'Flow Test Student',
      'test-corp',
      'Test Corporation',
      'A101'
    );

    // Verify student was created (ID is lowercased by the action)
    const student = await Student.findOne({ studentId: 'FLOW-001' });
    expect(student).not.toBeNull();
    expect(student?.email).toBe('flowtest@test.edu');

    // Verify initial scan was recorded
    const scans = await Scan.find({ studentId: 'FLOW-001' });
    expect(scans.length).toBeGreaterThanOrEqual(1);

    // Step 3: Student submits feedback
    const { addStudentFeedback } = await import('@/actions/feedback');
    await addStudentFeedback('FLOW-001', {
      'overall-rating': 5,
      'would-recommend': 'yes',
    });

    // Verify feedback was saved
    const feedback = await StudentFeedback.findOne({ studentId: 'FLOW-001' });
    expect(feedback).not.toBeNull();
    expect(feedback?.responses.get('overall-rating')).toBe(5);

    // Verify student marked as having submitted feedback
    const updatedStudent = await Student.findOne({ studentId: 'FLOW-001' });
    expect(updatedStudent?.feedbackSubmitted).toBe(true);
  });

  it('should track multiple visits for a student', async () => {
    // Create organizations
    await Organization.create([
      {
        organizationId: 'org-a',
        name: 'Organization A',
        industry: 'Tech',
        boothNumber: 'A1',
        qrCode: 'qr-a',
        contactPerson: 'P1',
        email: 'a@test.com',
        category: 'Tech',
        visitors: [],
        visitorCount: 0,
      },
      {
        organizationId: 'org-b',
        name: 'Organization B',
        industry: 'Finance',
        boothNumber: 'B1',
        qrCode: 'qr-b',
        contactPerson: 'P2',
        email: 'b@test.com',
        category: 'Finance',
        visitors: [],
        visitorCount: 0,
      },
    ]);

    // Create student with initial registration at org-a
    const { createStudent } = await import('@/actions/student');
    await createStudent('MULTI-001', 'multi@test.edu', 'Multi Visit Student', 'org-a', 'Organization A', 'A1');

    // Visit second organization - recordVisit needs: studentId, studentEmail, studentProgram, orgId, orgName, boothNumber
    const { recordVisit } = await import('@/actions/scans');
    await recordVisit('MULTI-001', 'multi@test.edu', 'Computer Science', 'org-b', 'Organization B', 'B1');

    // Verify all visits recorded
    const { getScansByStudent } = await import('@/actions/scans');
    const visits = await getScansByStudent('MULTI-001');
    
    expect(visits).toHaveLength(2);
    
    const orgIds = visits.map(v => v.organizationId);
    expect(orgIds).toContain('org-a');
    expect(orgIds).toContain('org-b');
  });
});

describe('Data Retrieval for Staff Dashboard', () => {
  it('should retrieve all data for analytics', async () => {
    // Setup: Create some test data
    await Organization.create({
      organizationId: 'analytics-org',
      name: 'Analytics Org',
      industry: 'Tech',
      boothNumber: 'Z1',
      qrCode: 'qr-analytics',
      contactPerson: 'Analytics Person',
      email: 'analytics@test.com',
      category: 'Tech',
      visitors: [],
      visitorCount: 0,
    });

    await Student.create({
      studentId: 'analytics-student',
      email: 'ana@test.edu',
      fullName: 'Analytics Student',
      visitedStalls: ['analytics-org'],
      scanCount: 1,
      feedbackSubmitted: true,
      registeredAt: new Date(),
      lastScanTime: new Date(),
    });

    await Scan.create({
      scanId: 'analytics-student_analytics-org',
      studentId: 'analytics-student',
      studentEmail: 'ana@test.edu',
      organizationId: 'analytics-org',
      organizationName: 'Analytics Org',
      boothNumber: 'Z1',
      timestamp: new Date(),
      scanMethod: 'qr_code',
    });

    await StudentFeedback.create({
      feedbackId: 'fb-analytics-student',
      studentId: 'analytics-student',
      responses: new Map([['rating', 5]]),
      timestamp: new Date(),
    });

    // Retrieve all data
    const { getAllStudents } = await import('@/actions/student');
    const { getAllOrganizations } = await import('@/actions/organizations');
    const { getAllScans } = await import('@/actions/scans');
    const { getAllStudentFeedback } = await import('@/actions/feedback');

    const students = await getAllStudents();
    const organizations = await getAllOrganizations();
    const scans = await getAllScans();
    const feedback = await getAllStudentFeedback();

    expect(students).toHaveLength(1);
    expect(organizations).toHaveLength(1);
    expect(scans).toHaveLength(1);
    expect(feedback).toHaveLength(1);
  });
});
