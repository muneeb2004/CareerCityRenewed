'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase';
import {
  OrganizationFeedback,
  FeedbackQuestion,
} from '../../../../src/lib/types';
import { getAllFeedbackQuestions } from '../../../../src/lib/firestore/feedbackQuestions';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      const allQuestions = await getAllFeedbackQuestions();
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
    setLoading(true);

    try {
      const feedbackId = `${organizationId}_${new Date().toISOString()}`;
      const feedbackRef = doc(db, 'organizationFeedback', feedbackId);

      // Process responses to fit the data model
      const processedResponses: { [key: string]: string | number | string[] } =
        {};
      for (const questionId in responses) {
        const question = questions.find((q) => q.questionId === questionId);
        if (question) {
          if (question.type === 'text' && question.text.toLowerCase().includes('student ids')) {
             processedResponses[questionId] = (responses[questionId] as string)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          } else {
            processedResponses[questionId] = responses[questionId];
          }
        }
      }


      const feedbackData: Omit<OrganizationFeedback, 'feedbackId'> = {
        organizationId,
        timestamp: serverTimestamp(),
        responses: processedResponses,
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
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white shadow-lg rounded-lg p-8 max-w-lg mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold mb-4 text-gray-800">
            Feedback Submitted!
          </h2>
          <p className="text-gray-600">
            Thank you for your valuable feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          End-of-Day Feedback
        </h2>
        <p className="text-gray-600 mb-6">
          Please share your experience at Career City 2026.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
              )}
              {question.type === 'textarea' && (
                <textarea
                  value={responses[question.questionId] || ''}
                  onChange={(e) =>
                    handleResponseChange(question.questionId, e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  rows={4}
                ></textarea>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 transition"
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
