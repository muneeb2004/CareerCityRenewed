
import { createOrganizationFeedbackQuestion } from '../src/firestore/organizationFeedbackQuestions';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

// Mock Firebase modules
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock('../src/lib/firebase', () => ({
  db: {},
}));

describe('organizationFeedbackQuestions Firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createOrganizationFeedbackQuestion should use a slugified ID', async () => {
    const mockQuestion = {
      text: 'How satisfied are you?',
      type: 'range' as const,
      order: 1,
    };

    const expectedSlug = 'how-satisfied-are-you';
    
    // Mock doc to return a ref that we can check against
    const mockDocRef = { id: expectedSlug, path: `organizationFeedbackQuestions/${expectedSlug}` };
    (doc as jest.Mock).mockReturnValue(mockDocRef);

    const resultId = await createOrganizationFeedbackQuestion(mockQuestion);

    // Verify doc was called with correct collection and ID
    expect(doc).toHaveBeenCalledWith(db, 'organizationFeedbackQuestions', expectedSlug);
    
    // Verify setDoc was called with the ref and data
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, {
      ...mockQuestion,
      createdAt: serverTimestamp(), // This will be the mocked function
    });

    expect(resultId).toBe(expectedSlug);
  });

  it('createOrganizationFeedbackQuestion should handle special characters in slug', async () => {
    const mockQuestion = {
      text: '  What is your favorite color? #awesome  ',
      type: 'text' as const,
    };

    const expectedSlug = 'what-is-your-favorite-color-awesome';

    const mockDocRef = { id: expectedSlug };
    (doc as jest.Mock).mockReturnValue(mockDocRef);

    const resultId = await createOrganizationFeedbackQuestion(mockQuestion);

    expect(doc).toHaveBeenCalledWith(db, 'organizationFeedbackQuestions', expectedSlug);
    expect(resultId).toBe(expectedSlug);
  });
});
