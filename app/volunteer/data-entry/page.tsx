'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { validateStudentId } from '../../../src/lib/validation';
import {
  VolunteerQuestion,
} from '../../../src/lib/types';
import { getAllVolunteerQuestions } from '../../../src/lib/firestore/volunteerQuestions';

// Hardcoded volunteer ID for now
const VOLUNTEER_ID = 'volunteer_01';

export default function DataEntryPage() {
  const [questions, setQuestions] = useState<VolunteerQuestion[]>([]);
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [studentId, setStudentId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuestions = async () => {
      const allQuestions = await getAllVolunteerQuestions();
      setQuestions(allQuestions);
      // Initialize responses state
      const initialResponses: { [key: string]: any } = {};
      allQuestions.forEach((q) => {
        if (q.type === 'range') {
          initialResponses[q.questionId] = 3; // Default for range
        } else {
          initialResponses[q.questionId] = '';
        }
      });
      setResponses(initialResponses);
    };
    fetchQuestions();
  }, []);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateStudentId(studentId);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid Student ID');
      return;
    }
    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const logsRef = collection(db, 'interactionLogs');
      await addDoc(logsRef, {
        volunteerId: VOLUNTEER_ID,
        studentId,
        organizationId,
        responses,
        timestamp: serverTimestamp(),
      });
      toast.success('Interaction logged successfully!');
      setStudentId('');
      setOrganizationId('');
      // Reset responses
      const initialResponses: { [key: string]: any } = {};
      questions.forEach((q) => {
        if (q.type === 'range') {
          initialResponses[q.questionId] = 3;
        } else {
          initialResponses[q.questionId] = '';
        }
      });
      setResponses(initialResponses);
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
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
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
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
            />
          </div>
          {questions.map((question) => (
            <div key={question.questionId}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {question.text}
              </label>
              {question.type === 'range' && (
                <>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={responses[question.questionId] || 3}
                    onChange={(e) =>
                      handleResponseChange(
                        question.questionId,
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </>
              )}
              {question.type === 'text' && (
                <input
                  type="text"
                  value={responses[question.questionId] || ''}
                  onChange={(e) =>
                    handleResponseChange(question.questionId, e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
                />
              )}
              {question.type === 'textarea' && (
                <textarea
                  value={responses[question.questionId] || ''}
                  onChange={(e) =>
                    handleResponseChange(question.questionId, e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
                  rows={4}
                ></textarea>
              )}
            </div>
          ))}
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
