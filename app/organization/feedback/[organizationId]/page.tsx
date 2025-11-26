'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase';
import { OrganizationFeedback } from '../../../../src/lib/types';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  const [formData, setFormData] = useState({
    studentEngagement: 3,
    qualityOfInteractions: 3,
    hiringInterest: '',
    suggestions: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const feedbackId = `${organizationId}_${new Date().toISOString()}`;
      const feedbackRef = doc(db, 'organizationFeedback', feedbackId);

      const feedbackData: Omit<OrganizationFeedback, 'feedbackId'> = {
        organizationId,
        timestamp: serverTimestamp(),
        responses: {
          studentEngagement: formData.studentEngagement,
          qualityOfInteractions: formData.qualityOfInteractions,
          hiringInterest: formData.hiringInterest
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          suggestions: formData.suggestions,
        },
      };

      await setDoc(feedbackRef, feedbackData);

      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      console.error('Feedback submission error:', err);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glassmorphic p-8 max-w-lg mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold mb-4 text-white">
            Feedback Submitted!
          </h2>
          <p className="text-gray-200">Thank you for your valuable feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <Toaster position="top-center" />
      <div className="glassmorphic p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-2 text-white">
          End-of-Day Feedback
        </h2>
        <p className="text-gray-200 mb-6">
          Please share your experience at Career City 2026.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Student Engagement (1-5)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={formData.studentEngagement}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  studentEngagement: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer range-lg"
            />
            <div className="flex justify-between text-xs text-gray-300">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Quality of Interactions (1-5)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={formData.qualityOfInteractions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  qualityOfInteractions: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer range-lg"
            />
            <div className="flex justify-between text-xs text-gray-300">
              <span>Poor</span>
              <span>Average</span>
              <span>Excellent</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Students You Are Interested In (optional)
            </label>
            <textarea
              value={formData.hiringInterest}
              onChange={(e) =>
                setFormData({ ...formData, hiringInterest: e.target.value })
              }
              className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-pastel-blue bg-white/20 text-white placeholder-gray-300"
              placeholder="Enter student IDs, separated by commas (e.g., ab12345, cd67890)"
              rows={3}
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Suggestions for Improvement (optional)
            </label>
            <textarea
              value={formData.suggestions}
              onChange={(e) =>
                setFormData({ ...formData, suggestions: e.target.value })
              }
              className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-pastel-blue bg-white/20 text-white placeholder-gray-300"
              placeholder="What can we do better next year?"
              rows={4}
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pastel-blue text-blue-800 py-3 rounded-lg font-semibold hover:bg-blue-300 disabled:bg-gray-300 transition"
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
