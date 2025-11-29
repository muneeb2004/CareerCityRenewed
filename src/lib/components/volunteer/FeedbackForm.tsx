'use client';

import { useState } from 'react';

interface FeedbackFormProps {
  title: string;
  idLabel: string;
  idPlaceholder: string;
  feedbackLabel: string;
  feedbackPlaceholder: string;
  submitButtonText: string;
  onSubmit: (id: string, feedback: string) => void;
}

export default function FeedbackForm({
  title,
  idLabel,
  idPlaceholder,
  feedbackLabel,
  feedbackPlaceholder,
  submitButtonText,
  onSubmit,
}: FeedbackFormProps) {
  const [id, setId] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(id, feedback);
    setId('');
    setFeedback('');
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-4xl font-bold text-center text-secondary mb-8">
            {title}
          </h1>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="id" className="block text-gray-700 text-sm font-bold mb-2">
                {idLabel}
              </label>
              <input
                type="text"
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={idPlaceholder}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="feedback" className="block text-gray-700 text-sm font-bold mb-2">
                {feedbackLabel}
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={feedbackPlaceholder}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
                required
              />
            </div>
            <div className="flex items-center justify-center">
              <button
                type="submit"
                className="bg-secondary hover:bg-secondary-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                {submitButtonText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
