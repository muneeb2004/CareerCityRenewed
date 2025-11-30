'use client';

import { useState, useEffect } from 'react';
import {
  createOrganizationFeedbackQuestion,
  getAllOrganizationFeedbackQuestions,
  updateOrganizationFeedbackQuestion,
  deleteOrganizationFeedbackQuestion,
} from '../../../src/firestore/organizationFeedbackQuestions';
import {
  OrganizationFeedbackQuestion,
  QUESTION_TYPES,
  QuestionType,
} from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackQuestionManagement() {
  const [questions, setQuestions] = useState<OrganizationFeedbackQuestion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<{
    text: string;
    type: QuestionType;
    minLabel?: string;
    maxLabel?: string;
  }>({
    text: '',
    type: 'text',
    minLabel: '',
    maxLabel: '',
  });
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<OrganizationFeedbackQuestion | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const data = await getAllOrganizationFeedbackQuestions();
    setQuestions(data);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    console.log('handleAddQuestion started'); // Debug log
    e.preventDefault();
    setLoading(true);
    try {
      if (editingQuestion) {
        await updateOrganizationFeedbackQuestion(editingQuestion.questionId, form);
        toast.success('Question updated!');
        setEditingQuestion(null);
          } else {
            console.log('Attempting to create question...'); // Debug log
            await createOrganizationFeedbackQuestion(form);
            console.log('createOrganizationFeedbackQuestion resolved.'); // Debug log
            toast.success('Question added!');
          }
          setForm({ text: '', type: 'text', minLabel: '', maxLabel: '' });
          setShowAddForm(false);
          fetchQuestions();
        } catch (err: unknown) {
          console.error('Error caught in handleAddQuestion:', err); // Debug log
          if (err instanceof Error) {
            toast.error(`Failed to save question: ${err.message}`);
          } else {
            toast.error('An unknown error occurred.');
          }
        } finally {
          console.log('setLoading(false) in finally'); // Debug log
          setLoading(false);    }
  };

  const handleEdit = (question: OrganizationFeedbackQuestion) => {
    setEditingQuestion(question);
    setForm({
      text: question.text,
      type: question.type,
      minLabel: question.minLabel || '',
      maxLabel: question.maxLabel || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteOrganizationFeedbackQuestion(questionId);
        toast.success('Question deleted!');
        fetchQuestions();
      } catch (err: unknown) {
        console.error(err);
        if (err instanceof Error) {
          toast.error(`Failed to delete question: ${err.message}`);
        } else {
          toast.error('An unknown error occurred while deleting the question.');
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="card-modern flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            Org Feedback Questions
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage the questions asked to organizations</p>
        </div>
        <button
          className={`${showAddForm ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' : 'btn-primary'} font-semibold py-2 px-4 rounded-xl transition-all duration-200`}
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingQuestion(null);
            setForm({ text: '', type: 'text', minLabel: '', maxLabel: '' });
          }}
        >
          {showAddForm && !editingQuestion
            ? 'Cancel'
            : 'Add New Question'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddQuestion}
          className="card-modern grid grid-cols-1 gap-5 animate-fade-in-up"
        >
          <h2 className="text-xl font-bold text-gray-800">
             {editingQuestion ? 'Edit Question' : 'Add New Question'}
          </h2>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Question Text</label>
            <input
                name="text"
                value={form.text}
                onChange={handleInputChange}
                placeholder="e.g., How was your overall experience?"
                className="input-modern"
                required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Answer Type</label>
            <div className="relative">
                <select
                    name="type"
                    value={form.type}
                    onChange={handleInputChange}
                    className="input-modern appearance-none"
                >
                    {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          {form.type === 'range' && (
            <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Min Label</label>
                <input
                    name="minLabel"
                    value={form.minLabel}
                    onChange={handleInputChange}
                    placeholder="e.g. Least Favorite"
                    className="input-modern"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Max Label</label>
                <input
                    name="maxLabel"
                    value={form.maxLabel}
                    onChange={handleInputChange}
                    placeholder="e.g. Most Favorite"
                    className="input-modern"
                />
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="btn-accent w-full mt-2"
            disabled={loading}
            onClick={() => console.log('Add Question button clicked')}
          >
            {loading
              ? editingQuestion
                ? 'Updating...'
                : 'Adding...'
              : editingQuestion
              ? 'Update Question'
              : 'Add Question'}
          </button>
        </form>
      )}

      {/* Questions List */}
      <div className="card-modern">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Existing Questions
             <span className="text-sm font-normal text-gray-400 ml-2">({questions.length})</span>
        </h2>
        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.questionId}
              className="glass-hover p-5 rounded-xl border border-white/60 flex items-center justify-between group transition-all duration-300"
            >
              <div>
                <p className="font-bold text-gray-800 text-lg">{question.text}</p>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-1 rounded-md">
                        {question.type}
                    </span>
                    {question.type === 'range' && (
                    <span className="text-xs text-gray-500">
                        Range: {question.minLabel || '1'} - {question.maxLabel || '5'}
                    </span>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => handleEdit(question)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={() => handleDelete(question.questionId)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
