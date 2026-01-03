'use client';

import { useState, useCallback } from 'react';
import {
  validateStudentId,
  generateEmail,
} from '../../lib/validation';
import {
  createStudent,
  getStudent,
  updateStudentVisit,
} from '../../firestore/student';
import { createScan } from '../../firestore/scans';
import { updateOrganizationVisitors } from '../../firestore/organizations';
import { saveStudentSession } from '../../lib/storage';
import { haptics } from '../../lib/haptics';
import toast from 'react-hot-toast';

interface StudentRegistrationProps {
  organizationId: string;
  organizationName: string;
  boothNumber: string;
  onComplete: () => void;
}

export default function StudentRegistration({
  organizationId,
  organizationName,
  boothNumber,
  onComplete,
}: StudentRegistrationProps) {
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStudentIdChange = useCallback((value: string) => {
    const cleanId = value.toLowerCase().trim();
    setStudentId(cleanId);

    const validation = validateStudentId(cleanId);
    if (validation.isValid) {
      setEmail(generateEmail(cleanId));
      setError('');
      haptics.success(); // Subtle feedback for valid input
    } else if (cleanId.length > 0) {
      setError(validation.error || '');
      setEmail('');
    }
  }, []);

  const handleSubmit = async () => {
    const validation = validateStudentId(studentId);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid Student ID');
      haptics.error();
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name');
      haptics.error();
      return;
    }

    setLoading(true);
    setError('');
    haptics.impact();

    try {
      // Check if student exists
      const existingStudent = await getStudent(studentId);

      if (!existingStudent) {
        // Create new student
        await createStudent(studentId, email, fullName.trim(), organizationId);
      } else {
        // Update existing student
        await updateStudentVisit(studentId, organizationId);
      }

      // Update organization visitors
      await updateOrganizationVisitors(organizationId, studentId);

      // Create scan record (using fullName in place of program for now)
      // Passing 1 as scanCount since this is the first visit for a new student
      // Note: If existing student, logic might need adjustment, but current flow seems to assume registration context.
      // However, the code handles "existingStudent" branch.
      // If existingStudent, scanCount should be incremented.
      // Let's check if we should use recordVisit for existing student?
      // But we already called updateStudentVisit separately.
      
      // To keep it simple and consistent with the requested change for NEW registrations (which create scan #1):
      // We need to know the scan count.
      
      // If we want to be safe, we should probably fetch the student again or use the known count.
      // But here we just did createStudent (count=1) or updateStudentVisit (count++).
      
      // Actually, if it's an EXISTING student, we don't know the new count easily here without reading it back.
      // But wait, the previous code was just createScan(). 
      // If I add a default param to createScan, it works as before (random ID) if I don't pass it.
      // BUT the user wants the ID format.
      
      // For NEW students, we know it is 1.
      // For EXISTING students, we should ideally use recordVisit instead of the split logic, 
      // BUT createStudent handles the "create if not exists" logic which recordVisit doesn't.
      
      // Strategy:
      // If new student: scanCount = 1.
      // If existing student: we can't easily guess. 
      // However, if we look at the flow:
      // handleSubmit checks `getStudent`.
      
      let currentScanCount = 1;
      if (existingStudent) {
         currentScanCount = (existingStudent.scanCount || 0) + 1;
      }

      await createScan(
        studentId,
        email,
        'Computer Science', // Default program for scan records
        organizationId,
        organizationName,
        boothNumber,
        currentScanCount
      );

      // Save session (using a default program)
      saveStudentSession(studentId, 'Computer Science');

      haptics.success();
      toast.success('Visit recorded successfully!');
      onComplete();
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
      haptics.error();
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-modern max-w-md mx-auto">
      <h2 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
        First Visit - Register
      </h2>
      <p className="text-gray-600 mb-8 leading-relaxed">
        Enter your details to start tracking visits
      </p>

      {/* Student ID Input */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Student ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g., ab12345"
          value={studentId}
          onChange={(e) => handleStudentIdChange(e.target.value)}
          maxLength={7}
          className="input-modern"
        />
        <p className="mt-1 text-xs text-gray-500">Format: 2 letters + 5 digits</p>
      </div>

      {/* Auto-filled Email */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Email (Auto-generated)
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="input-modern bg-gray-50/50 text-gray-500 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">Your HU student email</p>
      </div>

      {/* Full Name Input */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g., John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input-modern"
        />
        <p className="mt-1 text-xs text-gray-500">Enter your full name as registered</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50/80 border border-red-100 rounded-xl backdrop-blur-sm animate-pulse-slow">
          <div className="flex items-center gap-2 text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!validateStudentId(studentId).isValid || !fullName.trim() || loading}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-none"
      >
        {loading ? (
            <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Registering...
            </span>
        ) : 'Register & Record Visit'}
      </button>
    </div>
  );
}
