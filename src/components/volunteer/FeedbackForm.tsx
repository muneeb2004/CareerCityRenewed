'use client';

import { useState } from 'react';
import { QuestionType } from '../../types';

export interface Question {
  questionId: string;
  text: string;
  type: QuestionType;
  options?: string[];
  minLabel?: string;
  maxLabel?: string;
}

interface FeedbackFormProps {
  title: string;
  idLabel: string;
  idPlaceholder: string;
  questions: Question[];
  submitButtonText: string;
  onSubmit: (id: string, responses: Record<string, string>) => void;
}

export default function FeedbackForm({
  title,
  idLabel,
  idPlaceholder,
  questions,
  submitButtonText,
  onSubmit,
}: FeedbackFormProps) {
  const [id, setId] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(id, responses);
    setId('');
    setResponses({});
  };

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="card-modern">
          <h1 className="text-3xl font-extrabold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            {title}
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="id" className="block text-sm font-semibold text-gray-700 mb-2">
                {idLabel}
              </label>
              <input
                type="text"
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={idPlaceholder}
                className="input-modern"
                required
              />
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500 font-medium">No questions have been set by the staff yet.</p>
                <p className="text-xs text-gray-400 mt-1">(Debug: 0 questions loaded)</p>
              </div>
            ) : (
              questions.map((question) => (
                <div key={question.questionId} className="glass-hover p-6 rounded-xl border border-white/50 transition-all duration-200">
                  <label
                    htmlFor={question.questionId}
                    className="block text-base font-bold text-gray-800 mb-3"
                  >
                    {question.text}
                  </label>
                  {question.type === 'textarea' ? (
                    <textarea
                      id={question.questionId}
                      value={responses[question.questionId] || ''}
                      onChange={(e) =>
                        handleResponseChange(question.questionId, e.target.value)
                      }
                      className="input-modern min-h-[120px] resize-y"
                      required
                    />
                  ) : question.type === 'range' ? (
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between text-xs font-semibold text-gray-500 px-1 mb-3 uppercase tracking-wide">
                        <span>{question.minLabel || '1'}</span>
                        <span>{question.maxLabel || '5'}</span>
                      </div>
                      <div className="flex justify-between items-center px-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <label
                            key={value}
                            className="flex flex-col items-center cursor-pointer group relative"
                          >
                            <input
                              type="radio"
                              name={question.questionId}
                              value={value}
                              checked={responses[question.questionId] === String(value)}
                              onChange={(e) =>
                                handleResponseChange(question.questionId, e.target.value)
                              }
                              className="sr-only peer"
                              required
                            />
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-gray-200 text-gray-500 font-bold transition-all duration-200 peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-checked:text-white peer-checked:scale-110 group-hover:border-blue-300 shadow-sm">
                                {value}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      id={question.questionId}
                      value={responses[question.questionId] || ''}
                      onChange={(e) =>
                        handleResponseChange(question.questionId, e.target.value)
                      }
                      className="input-modern"
                      required
                    />
                  )}
                </div>
              ))
            )}

            <div className="pt-4">
              <button
                type="submit"
                className="btn-primary w-full text-lg shadow-xl hover:shadow-blue-500/40"
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
