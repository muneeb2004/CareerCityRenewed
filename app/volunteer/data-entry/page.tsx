'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { validateStudentId } from '../../../src/lib/validation';

// Hardcoded volunteer ID for now
const VOLUNTEER_ID = 'volunteer_01';

export default function DataEntryPage() {
  const [formData, setFormData] = useState({
    studentId: '',
    organizationId: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateStudentId(formData.studentId);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid Student ID');
      return;
    }
    if (!formData.organizationId) {
      setError('Organization ID is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const logsRef = collection(db, 'interactionLogs');
      await addDoc(logsRef, {
        volunteerId: VOLUNTEER_ID,
        studentId: formData.studentId,
        organizationId: formData.organizationId,
        notes: formData.notes,
        timestamp: serverTimestamp(),
      });
      toast.success('Interaction logged successfully!');
      setFormData({
        studentId: '',
        organizationId: '',
        notes: '',
      });
    } catch (err) {
      console.error('Data entry error:', err);
      toast.error('Failed to log interaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-center text-secondary mb-6">
          Detailed Data Entry
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student ID
            </label>
            <input
              type="text"
              name="studentId"
              placeholder="e.g., ab12345"
              value={formData.studentId}
              onChange={handleChange}
              maxLength={7}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization ID
            </label>
            <input
              type="text"
              name="organizationId"
              placeholder="e.g., google-pakistan"
              value={formData.organizationId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
              placeholder="Enter any relevant notes about the interaction"
              rows={5}
            ></textarea>
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary text-white py-3 rounded-lg font-semibold hover:bg-violet-600 disabled:bg-gray-300 transition"
          >
            {loading ? 'Submitting...' : 'Log Interaction'}
          </button>
        </form>
      </div>
    </div>
  );
}
