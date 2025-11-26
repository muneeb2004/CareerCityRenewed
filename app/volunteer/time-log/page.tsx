'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

// Hardcoded volunteer ID for now
const VOLUNTEER_ID = 'volunteer_01';

export default function TimeLogPage() {
  const [loading, setLoading] = useState(false);

  const handleTimeLog = async (action: 'check-in' | 'check-out') => {
    setLoading(true);

    try {
      const logsRef = collection(db, 'volunteerLogs');
      await addDoc(logsRef, {
        volunteerId: VOLUNTEER_ID,
        action,
        timestamp: serverTimestamp(),
      });
      toast.success(`Successfully ${action}!`);
    } catch (err) {
      console.error('Time log error:', err);
      toast.error('Failed to log time. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <Toaster position="top-center" />
      <div className="glassmorphic max-w-md mx-auto p-8">
        <h1 className="text-3xl font-bold text-center text-white mb-6">
          Time Log
        </h1>
        <div className="space-y-4">
          <button
            onClick={() => handleTimeLog('check-in')}
            disabled={loading}
            className="w-full bg-pastel-green text-green-800 py-3 rounded-lg font-semibold hover:bg-green-300 disabled:bg-gray-300 transition"
          >
            {loading ? 'Processing...' : 'Check-in'}
          </button>
          <button
            onClick={() => handleTimeLog('check-out')}
            disabled={loading}
            className="w-full bg-pastel-pink text-red-800 py-3 rounded-lg font-semibold hover:bg-red-300 disabled:bg-gray-300 transition"
          >
            {loading ? 'Processing...' : 'Check-out'}
          </button>
        </div>
      </div>
    </div>
  );
}
