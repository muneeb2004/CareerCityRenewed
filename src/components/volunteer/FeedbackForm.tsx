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
  scaleMax?: number;
  followUpLabel?: string;
  placeholder?: string;
  allowOther?: boolean;
}

interface FeedbackFormProps {
  title: string;
  idLabel: string;
  idPlaceholder: string;
  questions: Question[];
  submitButtonText: string;
  onSubmit: (id: string, responses: Record<string, string | string[]>) => void;
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
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(id, responses);
    setId('');
    setResponses({});
  };

  const handleResponseChange = (questionId: string, value: string | string[]) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    const current = (responses[questionId] as string[]) || [];
    if (checked) {
      handleResponseChange(questionId, [...current, option]);
    } else {
      handleResponseChange(questionId, current.filter((o) => o !== option));
    }
  };

  // Render scale/range selector
  const renderScale = (question: Question, namePrefix = '') => {
    const max = question.scaleMax || 5;
    const values = Array.from({ length: max }, (_, i) => i + 1);
    const fieldName = namePrefix ? `${question.questionId}_${namePrefix}` : question.questionId;
    
    return (
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex justify-between text-xs font-semibold text-gray-500 px-1 mb-3 uppercase tracking-wide">
          <span>{question.minLabel || '1'}</span>
          <span>{question.maxLabel || String(max)}</span>
        </div>
        <div className="flex justify-between items-center px-2">
          {values.map((value) => (
            <label
              key={value}
              className="flex flex-col items-center cursor-pointer group relative"
            >
              <input
                type="radio"
                name={fieldName}
                value={value}
                checked={responses[fieldName] === String(value)}
                onChange={(e) => handleResponseChange(fieldName, e.target.value)}
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
    );
  };

  // Render multiple choice (radio - single selection)
  const renderMultipleChoice = (question: Question, namePrefix = '') => {
    const fieldName = namePrefix ? `${question.questionId}_${namePrefix}` : question.questionId;
    const otherFieldName = `${fieldName}_other`;
    const isOtherSelected = responses[fieldName] === '__other__';
    
    return (
      <div className="space-y-2">
        {(question.options || []).map((option) => (
          <label
            key={option}
            className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200 has-checked:border-blue-500 has-checked:bg-blue-50"
          >
            <input
              type="radio"
              name={fieldName}
              value={option}
              checked={responses[fieldName] === option}
              onChange={(e) => handleResponseChange(fieldName, e.target.value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              required
            />
            <span className="ml-3 text-gray-700">{option}</span>
          </label>
        ))}
        {question.allowOther && (
          <>
            <label
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200 has-checked:border-blue-500 has-checked:bg-blue-50"
            >
              <input
                type="radio"
                name={fieldName}
                value="__other__"
                checked={isOtherSelected}
                onChange={(e) => handleResponseChange(fieldName, e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                required
              />
              <span className="ml-3 text-gray-700">Other</span>
            </label>
            {isOtherSelected && (
              <input
                type="text"
                value={(responses[otherFieldName] as string) || ''}
                onChange={(e) => handleResponseChange(otherFieldName, e.target.value)}
                placeholder="Please specify..."
                className="input-modern ml-7 mt-2"
                required
              />
            )}
          </>
        )}
      </div>
    );
  };

  // Render checkbox (multiple selection)
  const renderCheckbox = (question: Question) => {
    const selected = (responses[question.questionId] as string[]) || [];
    const otherFieldName = `${question.questionId}_other`;
    const isOtherSelected = selected.includes('__other__');
    
    return (
      <div className="space-y-2">
        {(question.options || []).map((option) => (
          <label
            key={option}
            className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200 has-checked:border-blue-500 has-checked:bg-blue-50"
          >
            <input
              type="checkbox"
              value={option}
              checked={selected.includes(option)}
              onChange={(e) => handleCheckboxChange(question.questionId, option, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-3 text-gray-700">{option}</span>
          </label>
        ))}
        {question.allowOther && (
          <>
            <label
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200 has-checked:border-blue-500 has-checked:bg-blue-50"
            >
              <input
                type="checkbox"
                value="__other__"
                checked={isOtherSelected}
                onChange={(e) => handleCheckboxChange(question.questionId, '__other__', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">Other</span>
            </label>
            {isOtherSelected && (
              <input
                type="text"
                value={(responses[otherFieldName] as string) || ''}
                onChange={(e) => handleResponseChange(otherFieldName, e.target.value)}
                placeholder="Please specify..."
                className="input-modern ml-7 mt-2"
                required
              />
            )}
          </>
        )}
      </div>
    );
  };

  // Render number input
  const renderNumber = (question: Question) => (
    <input
      type="number"
      id={question.questionId}
      value={(responses[question.questionId] as string) || ''}
      onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
      placeholder={question.placeholder || 'Enter a number'}
      className="input-modern"
      min="0"
      required
    />
  );

  // Render text input
  const renderText = (question: Question) => (
    <input
      type="text"
      id={question.questionId}
      value={(responses[question.questionId] as string) || ''}
      onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
      placeholder={question.placeholder || ''}
      className="input-modern"
      required
    />
  );

  // Render textarea
  const renderTextarea = (question: Question) => (
    <textarea
      id={question.questionId}
      value={(responses[question.questionId] as string) || ''}
      onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
      placeholder={question.placeholder || ''}
      className="input-modern min-h-[120px] resize-y"
      required
    />
  );

  // Render combined scale + text
  const renderScaleText = (question: Question) => (
    <div className="space-y-4">
      {renderScale(question, 'scale')}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          {question.followUpLabel || 'Additional comments (optional)'}
        </label>
        <textarea
          value={(responses[`${question.questionId}_text`] as string) || ''}
          onChange={(e) => handleResponseChange(`${question.questionId}_text`, e.target.value)}
          placeholder={question.placeholder || 'Please elaborate...'}
          className="input-modern min-h-20 resize-y"
        />
      </div>
    </div>
  );

  // Render combined multiple choice + text
  const renderMultipleChoiceText = (question: Question) => (
    <div className="space-y-4">
      {renderMultipleChoice(question, 'choice')}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          {question.followUpLabel || 'Additional comments (optional)'}
        </label>
        <textarea
          value={(responses[`${question.questionId}_text`] as string) || ''}
          onChange={(e) => handleResponseChange(`${question.questionId}_text`, e.target.value)}
          placeholder={question.placeholder || 'Please elaborate...'}
          className="input-modern min-h-20 resize-y"
        />
      </div>
    </div>
  );

  // Main question renderer
  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'range':
        return renderScale(question);
      case 'number':
        return renderNumber(question);
      case 'multiplechoice':
        return renderMultipleChoice(question);
      case 'checkbox':
        return renderCheckbox(question);
      case 'text':
        return renderText(question);
      case 'textarea':
        return renderTextarea(question);
      case 'scale_text':
        return renderScaleText(question);
      case 'multiplechoice_text':
        return renderMultipleChoiceText(question);
      default:
        return renderText(question);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="card-modern">
          <h1 className="text-3xl font-extrabold text-center mb-8 bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
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
                  {renderQuestion(question)}
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
