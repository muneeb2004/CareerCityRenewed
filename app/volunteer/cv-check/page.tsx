'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { validateStudentId } from '../../../src/lib/validation';

// Hardcoded volunteer ID for now
const VOLUNTEER_ID = 'volunteer_01';

export default function CVCheckPage() {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStudentIdChange = (value: string) => {
    const cleanId = value.toLowerCase().trim();
    setStudentId(cleanId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateStudentId(studentId);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid Student ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const logsRef = collection(db, 'volunteerLogs');
      await addDoc(logsRef, {
        volunteerId: VOLUNTEER_ID,
        action: 'cv-check',
        studentId,
        timestamp: serverTimestamp(),
      });
      toast.success(`CV for ${studentId} marked as checked!`);
      setStudentId('');
    } catch (err) {
      console.error('CV check error:', err);
      toast.error('Failed to mark CV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center text-secondary mb-6">
          CV Check
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student ID
            </label>
            <input
              type="text"
              placeholder="e.g., ab12345"
              value={studentId}
              onChange={(e) => handleStudentIdChange(e.target.value)}
              maxLength={7}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary text-white py-3 rounded-lg font-semibold hover:bg-violet-600 disabled:bg-gray-300 transition"
          >
            {loading ? 'Submitting...' : 'Mark CV as Checked'}
          </button>
        </form>
      </div>
    </div>
  );
}
