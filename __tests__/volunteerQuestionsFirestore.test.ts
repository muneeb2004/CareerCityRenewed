
import { createVolunteerQuestion } from '../src/firestore/volunteerQuestions';
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

describe('volunteerQuestions Firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createVolunteerQuestion should use a slugified ID', async () => {
    const mockQuestion = {
      text: 'How helpful was the volunteer?',
      type: 'range' as const,
      order: 1,
    };

    const expectedSlug = 'how-helpful-was-the-volunteer';
    
    // Mock doc to return a ref that we can check against
    const mockDocRef = { id: expectedSlug, path: `volunteerQuestions/${expectedSlug}` };
    (doc as jest.Mock).mockReturnValue(mockDocRef);

    const resultId = await createVolunteerQuestion(mockQuestion);

    // Verify doc was called with correct collection and ID
    expect(doc).toHaveBeenCalledWith(db, 'volunteerQuestions', expectedSlug);
    
    // Verify setDoc was called with the ref and data
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, {
      ...mockQuestion,
      createdAt: serverTimestamp(), // This will be the mocked function
    });

    expect(resultId).toBe(expectedSlug);
  });

  it('createVolunteerQuestion should handle linkedToQuestionId correctly (passed through)', async () => {
    // Note: The UI is responsible for passing the correct ID.
    // If the referenced question was created with the new logic, its ID will be a slug.
    // Here we test that whatever is passed is saved.
    
    const mockQuestion = {
      text: 'Why did you choose this organization?',
      type: 'text' as const,
      isPerOrganization: true,
      linkedToQuestionId: 'which-organizations-did-you-visit' // Simulating a slug ID
    };

    const expectedSlug = 'why-did-you-choose-this-organization';
    const mockDocRef = { id: expectedSlug };
    (doc as jest.Mock).mockReturnValue(mockDocRef);

    await createVolunteerQuestion(mockQuestion);

    expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
      linkedToQuestionId: 'which-organizations-did-you-visit'
    }));
  });
});
