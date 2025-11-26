// Prompt for Copilot: "Create React component for student registration with Student ID input (validates xx#####), auto-filled email, program dropdown, using validation utils, and Firestore student creation"

'use client';

import { useState } from 'react';
import {
  validateStudentId,
  generateEmail,
  validateProgram,
} from '../../validation';
import {
  createStudent,
  getStudent,
  updateStudentVisit,
} from '../../firestore/student';
import { createScan } from '../../firestore/scans';
import { saveStudentSession } from '../../storage';
import { PROGRAMS, Program } from '../../types';
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
  const [program, setProgram] = useState<Program | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStudentIdChange = (value: string) => {
    const cleanId = value.toLowerCase().trim();
    setStudentId(cleanId);

    const validation = validateStudentId(cleanId);
    if (validation.isValid) {
      setEmail(generateEmail(cleanId));
      setError('');
    } else if (cleanId.length > 0) {
      setError(validation.error || '');
      setEmail('');
    }
  };

  const handleSubmit = async () => {
    const validation = validateStudentId(studentId);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid Student ID');
      return;
    }

    if (!program) {
      setError('Please select your program');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if student exists
      const existingStudent = await getStudent(studentId);

      if (!existingStudent) {
        // Create new student
        await createStudent(studentId, email, program, organizationId);
      } else {
        // Update existing student
        await updateStudentVisit(studentId, organizationId);
      }

      // Create scan record
      await createScan(
        studentId,
        email,
        program,
        organizationId,
        organizationName,
        boothNumber
      );

      // Save session
      saveStudentSession(studentId, program);

      toast.success('Visit recorded successfully!');
      onComplete();
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2">First Visit - Register</h2>
      <p className="text-gray-600 mb-6">
        Enter your details to start tracking visits
      </p>

      {/* Student ID Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Student ID *
        </label>
        <input
          type="text"
          placeholder="e.g., ab12345"
          value={studentId}
          onChange={(e) => handleStudentIdChange(e.target.value)}
          maxLength={7}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <small className="text-gray-500">Format: 2 letters + 5 digits</small>
      </div>

      {/* Auto-filled Email */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email (Auto-generated)
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
        />
        <small className="text-gray-500">Your HU student email</small>
      </div>

      {/* Program Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Program *
        </label>
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value as Program)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Select your program --</option>
          {PROGRAMS.map((prog: Program) => (
            <option key={prog} value={prog}>
              {prog}
            </option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!validateStudentId(studentId).isValid || !program || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Registering...' : 'Register & Record Visit'}
      </button>
    </div>
  );
}