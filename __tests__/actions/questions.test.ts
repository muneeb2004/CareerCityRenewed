/**
 * Unit Tests for Questions Server Actions
 * Phase 6: Testing & Validation
 * @jest-environment node
 */

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { VolunteerQuestion, OrgQuestion } from '@/models/Question';
import { TestDataFactory, createSlug } from '../utils/testHelpers';

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
  await VolunteerQuestion.deleteMany({});
  await OrgQuestion.deleteMany({});
  jest.clearAllMocks();
});

describe('Slug Generation', () => {
  it('should generate consistent slugs', () => {
    expect(createSlug('How was your day?')).toBe('how-was-your-day');
    expect(createSlug('Rate from 1-10')).toBe('rate-from-1-10');
    expect(createSlug('  Spaces  around  ')).toBe('spaces-around');
    expect(createSlug('Special@#$Characters!')).toBe('specialcharacters');
    expect(createSlug('Multiple---hyphens')).toBe('multiple-hyphens');
  });

  it('should handle edge cases', () => {
    expect(createSlug('')).toBe('');
    expect(createSlug('   ')).toBe('');
    expect(createSlug('a')).toBe('a');
    expect(createSlug('UPPERCASE')).toBe('uppercase');
  });
});

describe('Volunteer Questions Actions', () => {
  describe('createVolunteerQuestion', () => {
    it('should create a new question with generated slug', async () => {
      const questionData = TestDataFactory.volunteerQuestion({
        text: 'How was your experience?',
      });

      const { createVolunteerQuestion } = await import('@/actions/questions');
      const slug = await createVolunteerQuestion(questionData);

      expect(slug).toBe('how-was-your-experience');

      const savedQuestion = await VolunteerQuestion.findOne({ slug });
      expect(savedQuestion).not.toBeNull();
      expect(savedQuestion?.text).toBe(questionData.text);
    });

    it('should upsert existing question with same slug', async () => {
      const questionData = TestDataFactory.volunteerQuestion({
        text: 'Unique Question',
        type: 'text',
      });

      const { createVolunteerQuestion } = await import('@/actions/questions');
      
      // Create first time
      await createVolunteerQuestion(questionData);
      
      // Create again with different type
      const updatedData = { ...questionData, type: 'range' as const };
      await createVolunteerQuestion(updatedData);

      // Should only have one question
      const count = await VolunteerQuestion.countDocuments();
      expect(count).toBe(1);

      // Should have updated type
      const question = await VolunteerQuestion.findOne({ slug: 'unique-question' });
      expect(question?.type).toBe('range');
    });
  });

  describe('getAllVolunteerQuestions', () => {
    it('should return all questions sorted by order', async () => {
      await VolunteerQuestion.create([
        { slug: 'q3', text: 'Question 3', type: 'text', order: 3 },
        { slug: 'q1', text: 'Question 1', type: 'text', order: 1 },
        { slug: 'q2', text: 'Question 2', type: 'text', order: 2 },
      ]);

      const { getAllVolunteerQuestions } = await import('@/actions/questions');
      const result = await getAllVolunteerQuestions();

      expect(result).toHaveLength(3);
      expect(result[0].slug).toBe('q1');
      expect(result[1].slug).toBe('q2');
      expect(result[2].slug).toBe('q3');
    });

    it('should map slug to questionId for frontend compatibility', async () => {
      await VolunteerQuestion.create({
        slug: 'test-slug',
        text: 'Test',
        type: 'text',
      });

      const { getAllVolunteerQuestions } = await import('@/actions/questions');
      const result = await getAllVolunteerQuestions();

      expect(result[0].questionId).toBe('test-slug');
    });
  });

  describe('updateVolunteerQuestion', () => {
    it('should update question by slug', async () => {
      await VolunteerQuestion.create({
        slug: 'test-question',
        text: 'Original Text',
        type: 'text',
      });

      const { updateVolunteerQuestion } = await import('@/actions/questions');
      await updateVolunteerQuestion('test-question', { text: 'Updated Text' });

      const updated = await VolunteerQuestion.findOne({ slug: 'test-question' });
      expect(updated?.text).toBe('Updated Text');
    });
  });

  describe('deleteVolunteerQuestion', () => {
    it('should delete question by slug', async () => {
      await VolunteerQuestion.create({
        slug: 'to-delete',
        text: 'Delete Me',
        type: 'text',
      });

      const { deleteVolunteerQuestion } = await import('@/actions/questions');
      await deleteVolunteerQuestion('to-delete');

      const deleted = await VolunteerQuestion.findOne({ slug: 'to-delete' });
      expect(deleted).toBeNull();
    });
  });
});

describe('Organization Feedback Questions Actions', () => {
  describe('createOrganizationFeedbackQuestion', () => {
    it('should create org question with all properties', async () => {
      const questionData = TestDataFactory.orgQuestion({
        text: 'Rate our booth setup',
        minLabel: 'Terrible',
        maxLabel: 'Amazing',
        scaleMax: 10,
      });

      const { createOrganizationFeedbackQuestion } = await import('@/actions/questions');
      const slug = await createOrganizationFeedbackQuestion(questionData);

      expect(slug).toBe('rate-our-booth-setup');

      const saved = await OrgQuestion.findOne({ slug });
      expect(saved?.minLabel).toBe('Terrible');
      expect(saved?.maxLabel).toBe('Amazing');
      expect(saved?.scaleMax).toBe(10);
    });
  });

  describe('getAllOrganizationFeedbackQuestions', () => {
    it('should return all org questions sorted by order', async () => {
      await OrgQuestion.create([
        { slug: 'oq2', text: 'Org Q2', type: 'range', order: 2 },
        { slug: 'oq1', text: 'Org Q1', type: 'range', order: 1 },
      ]);

      const { getAllOrganizationFeedbackQuestions } = await import('@/actions/questions');
      const result = await getAllOrganizationFeedbackQuestions();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('oq1');
    });
  });

  describe('updateOrganizationFeedbackQuestion', () => {
    it('should update org question', async () => {
      await OrgQuestion.create({
        slug: 'org-test',
        text: 'Original',
        type: 'range',
      });

      const { updateOrganizationFeedbackQuestion } = await import('@/actions/questions');
      await updateOrganizationFeedbackQuestion('org-test', { 
        minLabel: 'Low',
        maxLabel: 'High' 
      });

      const updated = await OrgQuestion.findOne({ slug: 'org-test' });
      expect(updated?.minLabel).toBe('Low');
      expect(updated?.maxLabel).toBe('High');
    });
  });

  describe('deleteOrganizationFeedbackQuestion', () => {
    it('should delete org question', async () => {
      await OrgQuestion.create({
        slug: 'org-delete',
        text: 'Delete',
        type: 'range',
      });

      const { deleteOrganizationFeedbackQuestion } = await import('@/actions/questions');
      await deleteOrganizationFeedbackQuestion('org-delete');

      const deleted = await OrgQuestion.findOne({ slug: 'org-delete' });
      expect(deleted).toBeNull();
    });
  });
});
