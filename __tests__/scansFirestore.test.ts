
import { createScan, recordVisit } from '../src/firestore/scans';
import { db } from '../src/lib/firebase';
import { 
  addDoc, 
  setDoc, 
  runTransaction, 
  doc, 
  collection, 
  serverTimestamp,
  arrayUnion,
  increment
} from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  doc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  arrayUnion: jest.fn(),
  increment: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('../src/lib/firebase', () => ({
  db: {},
}));

describe('scans Firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createScan', () => {
    it('should use addDoc (random ID) when scanCount is NOT provided', async () => {
      const mockScan = {
        studentId: 'test-student',
        studentEmail: 'test@example.com',
        studentProgram: 'Computer Science' as const,
        organizationId: 'org-1',
        organizationName: 'Test Org',
        boothNumber: 'A1',
      };

      await createScan(
        mockScan.studentId,
        mockScan.studentEmail,
        mockScan.studentProgram,
        mockScan.organizationId,
        mockScan.organizationName,
        mockScan.boothNumber
      );

      expect(addDoc).toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should use setDoc with custom ID when scanCount IS provided', async () => {
      const mockScan = {
        studentId: 'test-student',
        studentEmail: 'test@example.com',
        studentProgram: 'Computer Science' as const,
        organizationId: 'org-1',
        organizationName: 'Test Org',
        boothNumber: 'A1',
      };
      const scanCount = 5;
      const expectedId = 'test-student_5';

      const mockDocRef = { id: expectedId };
      (doc as jest.Mock).mockReturnValue(mockDocRef);

      await createScan(
        mockScan.studentId,
        mockScan.studentEmail,
        mockScan.studentProgram,
        mockScan.organizationId,
        mockScan.organizationName,
        mockScan.boothNumber,
        scanCount
      );

      expect(doc).toHaveBeenCalledWith(db, 'scans', expectedId);
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        scanId: expectedId,
        studentId: mockScan.studentId
      }));
      expect(addDoc).not.toHaveBeenCalled();
    });
  });

  describe('recordVisit', () => {
    it('should run a transaction and set correct IDs', async () => {
        const mockTransaction = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
        };

        (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
            return await callback(mockTransaction);
        });

        const studentId = 'student-123';
        const scanCount = 10;
        
        // Mock Student Data
        mockTransaction.get.mockResolvedValue({
            exists: () => true,
            data: () => ({
                scanCount: scanCount,
                visitedStalls: []
            })
        });

        const mockScanRef = { id: `${studentId}_${scanCount + 1}` };
        (doc as jest.Mock).mockImplementation((db, collection, id) => ({ path: `${collection}/${id}` }));

        await recordVisit(
            studentId,
            'email@test.com',
            'Computer Science',
            'org-1',
            'Org Name',
            'B1'
        );

        // Verify transaction steps
        expect(mockTransaction.get).toHaveBeenCalled(); // Should get student
        
        // Check if set was called for the scan with correct ID
        // Note: We need to verify the doc ref passed to set
        // Since we mocked doc(), we can check the calls to doc()
        expect(doc).toHaveBeenCalledWith(db, 'scans', `${studentId}_11`);
        
        expect(mockTransaction.set).toHaveBeenCalledWith(
            expect.objectContaining({ path: `scans/${studentId}_11` }), 
            expect.objectContaining({
                scanId: `${studentId}_11`,
                studentId: studentId
            })
        );

        expect(mockTransaction.update).toHaveBeenCalledTimes(2); // Student and Org updates
    });
  });
});
