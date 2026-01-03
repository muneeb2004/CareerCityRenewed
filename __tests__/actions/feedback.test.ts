/**
 * Unit Tests for Feedback Server Actions
 * Phase 6: Testing & Validation
 * @jest-environment node
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
let StudentFeedback: typeof import('@/models/Feedback').StudentFeedback;
let OrgFeedback: typeof import('@/models/Feedback').OrgFeedback;
let Student: typeof import('@/models/Student').Student;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const mongoUri = mongoReplSet.getUri();
  await mongoose.connect(mongoUri);
  
  // Import models after connection
  const feedbackModule = await import('@/models/Feedback');
  StudentFeedback = feedbackModule.StudentFeedback;
  OrgFeedback = feedbackModule.OrgFeedback;
  const studentModule = await import('@/models/Student');
  Student = studentModule.Student;
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

describe('addStudentFeedback', () => {
  it('should create feedback for a student', async () => {
    // Create student first
    await Student.create({
      studentId: 'student-fb-001',
      email: 'fb@test.com',
      fullName: 'Feedback Student',
      visitedStalls: [],
      scanCount: 1,
      feedbackSubmitted: false,
      registeredAt: new Date(),
      lastScanTime: new Date(),
    });

    const { addStudentFeedback } = await import('@/actions/feedback');
    
    await addStudentFeedback('student-fb-001', {
      'career-interest': 'Technology',
      'event-rating': 5,
    });

    const saved = await StudentFeedback.findOne({ studentId: 'student-fb-001' });
    expect(saved).not.toBeNull();
    expect(saved?.feedbackId).toBe('feedback_student-fb-001');
    expect(saved?.responses.get('event-rating')).toBe(5);
    
    // Check student was updated
    const student = await Student.findOne({ studentId: 'student-fb-001' });
    expect(student?.feedbackSubmitted).toBe(true);
  });
});

describe('hasStudentSubmittedFeedback', () => {
  it('should return true if feedback exists', async () => {
    await StudentFeedback.create({
      feedbackId: 'feedback_check-student',
      studentId: 'check-student',
      responses: new Map([['q1', 'answer']]),
      timestamp: new Date(),
    });

    const { hasStudentSubmittedFeedback } = await import('@/actions/feedback');
    const result = await hasStudentSubmittedFeedback('check-student');

    expect(result).toBe(true);
  });

  it('should return false if no feedback exists', async () => {
    const { hasStudentSubmittedFeedback } = await import('@/actions/feedback');
    const result = await hasStudentSubmittedFeedback('no-feedback-student');

    expect(result).toBe(false);
  });
});

describe('getAllStudentFeedback', () => {
  it('should return all student feedback', async () => {
    await StudentFeedback.create([
      {
        feedbackId: 'fb-1',
        studentId: 'student-1',
        responses: new Map([['q1', 'a1']]),
        timestamp: new Date(),
      },
      {
        feedbackId: 'fb-2',
        studentId: 'student-2',
        responses: new Map([['q1', 'a2']]),
        timestamp: new Date(),
      },
    ]);

    const { getAllStudentFeedback } = await import('@/actions/feedback');
    const result = await getAllStudentFeedback();

    expect(result).toHaveLength(2);
    expect(result[0].feedbackId).toBe('fb-1');
    expect(result[1].feedbackId).toBe('fb-2');
  });

  it('should return empty array when no feedback exists', async () => {
    const { getAllStudentFeedback } = await import('@/actions/feedback');
    const result = await getAllStudentFeedback();

    expect(result).toEqual([]);
  });
});

describe('getStudentFeedbackByStudentId', () => {
  it('should retrieve feedback for specific student', async () => {
    await StudentFeedback.create({
      feedbackId: 'fb-specific',
      studentId: 'specific-student',
      responses: new Map([['rating', 5], ['comment', 'Great!']]),
      timestamp: new Date(),
    });

    const { getStudentFeedbackByStudentId } = await import('@/actions/feedback');
    const result = await getStudentFeedbackByStudentId('specific-student');

    expect(result).not.toBeNull();
    expect(result?.studentId).toBe('specific-student');
    expect(result?.responses['rating']).toBe(5);
  });

  it('should return null for student with no feedback', async () => {
    const { getStudentFeedbackByStudentId } = await import('@/actions/feedback');
    const result = await getStudentFeedbackByStudentId('nonexistent-student');

    expect(result).toBeNull();
  });
});

describe('Organization Feedback', () => {
  describe('addOrganizationFeedback', () => {
    it('should create organization feedback', async () => {
      const { addOrganizationFeedback } = await import('@/actions/feedback');
      
      await addOrganizationFeedback('org-fb-001', {
        'booth-setup': 5,
        'staff-helpfulness': 4,
      });

      const saved = await OrgFeedback.findOne({ organizationId: 'org-fb-001' });
      expect(saved).not.toBeNull();
      expect(saved?.feedbackId).toBe('feedback_org-fb-001');
    });
  });

  describe('hasOrganizationSubmittedFeedback', () => {
    it('should return true if feedback exists', async () => {
      await OrgFeedback.create({
        feedbackId: 'fb-org-check',
        organizationId: 'org-check',
        responses: new Map([['q1', 'answer']]),
        timestamp: new Date(),
      });

      const { hasOrganizationSubmittedFeedback } = await import('@/actions/feedback');
      const result = await hasOrganizationSubmittedFeedback('org-check');

      expect(result).toBe(true);
    });

    it('should return false if no feedback exists', async () => {
      const { hasOrganizationSubmittedFeedback } = await import('@/actions/feedback');
      const result = await hasOrganizationSubmittedFeedback('no-feedback-org');

      expect(result).toBe(false);
    });
  });

  describe('getAllOrganizationFeedback', () => {
    it('should return all organization feedback', async () => {
      await OrgFeedback.create([
        {
          feedbackId: 'org-fb-1',
          organizationId: 'org-1',
          responses: new Map([['q1', 'a1']]),
          timestamp: new Date(),
        },
        {
          feedbackId: 'org-fb-2',
          organizationId: 'org-2',
          responses: new Map([['q1', 'a2']]),
          timestamp: new Date(),
        },
      ]);

      const { getAllOrganizationFeedback } = await import('@/actions/feedback');
      const result = await getAllOrganizationFeedback();

      expect(result).toHaveLength(2);
    });
  });
});
