'use client';

import { useState, useEffect } from 'react';
import {
  createOrganizationFeedbackQuestion,
  getAllOrganizationFeedbackQuestions,
  updateOrganizationFeedbackQuestion,
  deleteOrganizationFeedbackQuestion,
} from '../../../src/lib/firestore/organizationFeedbackQuestions';
import {
  OrganizationFeedbackQuestion,
  QUESTION_TYPES,
  QuestionType,
} from '../../../src/lib/types';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackQuestionManagement() {
  const [questions, setQuestions] = useState<OrganizationFeedbackQuestion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<{
    text: string;
    type: QuestionType;
  }>({
    text: '',
    type: 'text',
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
    e.preventDefault();
    setLoading(true);
    try {
      if (editingQuestion) {
        await updateOrganizationFeedbackQuestion(editingQuestion.questionId, form);
        toast.success('Question updated!');
        setEditingQuestion(null);
      } else {
        await createOrganizationFeedbackQuestion(form);
        toast.success('Question added!');
      }
      setForm({ text: '', type: 'text' });
      setShowAddForm(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save question');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: OrganizationFeedbackQuestion) => {
    setEditingQuestion(question);
    setForm({ text: question.text, type: question.type });
    setShowAddForm(true);
  };

  const handleDelete = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteOrganizationFeedbackQuestion(questionId);
        toast.success('Question deleted!');
        fetchQuestions();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete question');
      }
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Organization Feedback Questions Management
        </h1>
        <button
          className="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingQuestion(null);
            setForm({ text: '', type: 'text' });
          }}
        >
          {showAddForm && !editingQuestion
            ? 'Cancel'
            : 'Add New Question'}
        </button>
      </div>
      {showAddForm && (
        <form
          onSubmit={handleAddQuestion}
          className="bg-white shadow-lg rounded-lg p-6 mb-8 grid grid-cols-1 gap-4"
        >
          <input
            name="text"
            value={form.text}
            onChange={handleInputChange}
            placeholder="Question text"
            className="border p-2 rounded"
            required
          />
          <select
            name="type"
            value={form.type}
            onChange={handleInputChange}
            className="border p-2 rounded"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-accent text-white py-2 rounded-lg font-semibold hover:bg-emerald-600"
            disabled={loading}
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
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Existing Questions
        </h2>
        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.questionId}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-semibold text-gray-800">{question.text}</p>
                <p className="text-sm text-gray-500">Type: {question.type}</p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleEdit(question)}
                  className="bg-secondary text-white px-3 py-1 rounded-lg font-semibold hover:bg-violet-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(question.questionId)}
                  className="bg-red-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
