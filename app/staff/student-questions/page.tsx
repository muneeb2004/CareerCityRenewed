'use client';

import { useState, useEffect } from 'react';
import {
  createVolunteerQuestion,
  getAllVolunteerQuestions,
  updateVolunteerQuestion,
  deleteVolunteerQuestion,
} from '@/firestore/volunteerQuestions';
import {
  VolunteerQuestion,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  QuestionType,
} from '@/types';
import { Toaster } from 'react-hot-toast';
import { showSuccess, showError } from '@/lib/utils/toast';
import CustomSelect from '@/lib/components/ui/CustomSelect';
import { ListRowSkeleton } from '@/lib/components/ui/Skeleton';
import { EmptyState } from '@/lib/components/ui/EmptyState';
import { Modal } from '@/lib/components/ui/Modal';
import { ConfirmationModal } from '@/lib/components/ui/ConfirmationModal';

export default function StudentQuestionManagement() {
  const [questions, setQuestions] = useState<VolunteerQuestion[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<{
    text: string;
    type: QuestionType;
    minLabel?: string;
    maxLabel?: string;
    scaleMax?: number;
    options?: string[];
    followUpLabel?: string;
    placeholder?: string;
    selectionCount?: number;
    selectionMode?: 'exactly' | 'up_to';
    isPerOrganization?: boolean;
    linkedToQuestionId?: string;
    allowOther?: boolean;
  }>({
    text: '',
    type: 'text',
    minLabel: '',
    maxLabel: '',
    scaleMax: 5,
    options: [],
    followUpLabel: '',
    placeholder: '',
    selectionCount: 5,
    selectionMode: 'up_to',
    isPerOrganization: false,
    linkedToQuestionId: '',
    allowOther: false,
  });
  const [optionInput, setOptionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<VolunteerQuestion | null>(null);
  
  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const data = await getAllVolunteerQuestions();
      setQuestions(data);
    } catch (error) {
      console.error(error);
      showError("Failed to load questions");
    } finally {
      setFetching(false);
    }
  };

  // Get organization_select questions for linking
  const organizationSelectQuestions = questions.filter(q => q.type === 'organization_select');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (name === 'scaleMax' || name === 'selectionCount') {
      setForm({ ...form, [name]: parseInt(value) || (name === 'selectionCount' ? 5 : 5) });
    } else if (type === 'checkbox') {
      setForm({ ...form, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const addOption = () => {
    if (optionInput.trim()) {
      // Check if input contains commas - bulk add
      if (optionInput.includes(',')) {
        const newOptions = optionInput
          .split(',')
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0);
        setForm({ ...form, options: [...(form.options || []), ...newOptions] });
      } else {
        setForm({ ...form, options: [...(form.options || []), optionInput.trim()] });
      }
      setOptionInput('');
    }
  };

  const clearAllOptions = () => {
    setForm({ ...form, options: [] });
  };

  const removeOption = (index: number) => {
    setForm({ ...form, options: (form.options || []).filter((_, i) => i !== index) });
  };

  const resetForm = () => {
    setForm({
      text: '',
      type: 'text',
      minLabel: '',
      maxLabel: '',
      scaleMax: 5,
      options: [],
      followUpLabel: '',
      placeholder: '',
      selectionCount: 5,
      selectionMode: 'up_to',
      isPerOrganization: false,
      linkedToQuestionId: '',
      allowOther: false,
    });
    setOptionInput('');
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Build the question data with required fields
      const questionData: Omit<VolunteerQuestion, 'questionId'> = {
        text: form.text,
        type: form.type,
      };

      // Add type-specific fields
      if (form.type === 'range' || form.type === 'scale_text') {
        questionData.minLabel = form.minLabel;
        questionData.maxLabel = form.maxLabel;
        questionData.scaleMax = form.scaleMax;
      }

      if (form.type === 'multiplechoice' || form.type === 'checkbox' || form.type === 'multiplechoice_text') {
        questionData.options = form.options;
        questionData.allowOther = form.allowOther;
      }

      if (form.type === 'scale_text' || form.type === 'multiplechoice_text') {
        questionData.followUpLabel = form.followUpLabel;
      }

      if (form.type === 'text' || form.type === 'textarea' || form.type === 'number' || 
          form.type === 'scale_text' || form.type === 'multiplechoice_text') {
        questionData.placeholder = form.placeholder;
      }

      // Organization select specific
      if (form.type === 'organization_select') {
        questionData.selectionCount = form.selectionCount;
        questionData.selectionMode = form.selectionMode || 'up_to';
      }

      // Per-organization question linking
      if (form.isPerOrganization && form.linkedToQuestionId) {
        questionData.isPerOrganization = true;
        questionData.linkedToQuestionId = form.linkedToQuestionId;
      }

      if (editingQuestion) {
        await updateVolunteerQuestion(editingQuestion.questionId, questionData);
        showSuccess('Question updated!');
        setEditingQuestion(null);
      } else {
        await createVolunteerQuestion(questionData);
        showSuccess('Question added!');
      }
      resetForm();
      setShowAddForm(false);
      fetchQuestions();
    } catch (err: unknown) {
      console.error('Error:', err);
      if (err instanceof Error) {
        showError(`Failed to save question: ${err.message}`);
      } else {
        showError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: VolunteerQuestion) => {
    setEditingQuestion(question);
    setForm({
      text: question.text,
      type: question.type,
      minLabel: question.minLabel || '',
      maxLabel: question.maxLabel || '',
      scaleMax: question.scaleMax || 5,
      options: question.options || [],
      followUpLabel: question.followUpLabel || '',
      placeholder: question.placeholder || '',
      selectionCount: question.selectionCount || 5,
      selectionMode: question.selectionMode || 'up_to',
      isPerOrganization: question.isPerOrganization || false,
      linkedToQuestionId: question.linkedToQuestionId || '',
      allowOther: question.allowOther || false,
    });
    setShowAddForm(true);
  };

  const handleDelete = (questionId: string) => {
    setDeleteId(questionId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteVolunteerQuestion(deleteId);
      showSuccess('Question deleted!');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      showError('Failed to delete question');
    }
  };

  // Reorder questions within a category
  const handleReorder = async (questionId: string, direction: 'up' | 'down', categoryQuestions: VolunteerQuestion[]) => {
    const sortedQuestions = [...categoryQuestions].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const currentIndex = sortedQuestions.findIndex(q => q.questionId === questionId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedQuestions.length - 1) return;
    
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentQuestion = sortedQuestions[currentIndex];
    const swapQuestion = sortedQuestions[swapIndex];
    
    try {
      // Swap order values
      const currentOrder = currentQuestion.order ?? currentIndex;
      const swapOrder = swapQuestion.order ?? swapIndex;
      
      await updateVolunteerQuestion(currentQuestion.questionId, { order: swapOrder });
      await updateVolunteerQuestion(swapQuestion.questionId, { order: currentOrder });
      
      showSuccess('Question reordered');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      showError('Failed to reorder question');
    }
  };

  // Get linked questions for display
  const getLinkedQuestions = (questionId: string) => {
    return questions.filter(q => q.linkedToQuestionId === questionId);
  };

  // Get sorted questions by category
  const orgSelectQuestions = questions
    .filter(q => q.type === 'organization_select')
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  
  const perOrgQuestionsFiltered = questions
    .filter(q => q.isPerOrganization)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  
  const generalQuestionsFiltered = questions
    .filter(q => q.type !== 'organization_select' && !q.isPerOrganization)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Check if current question type supports per-organization linking
  const supportsPerOrgLinking = form.type !== 'organization_select' && organizationSelectQuestions.length > 0;

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="card-modern flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            Student Questions
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage the questions asked to students</p>
        </div>
        <button
          className="btn-primary font-semibold py-2 px-4 rounded-xl transition-all duration-200"
          onClick={() => {
            setEditingQuestion(null);
            resetForm();
            setShowAddForm(true);
          }}
        >
          Add New Question
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Question Flow for Students:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li><strong>Organization Selection</strong> - Students select their top favorite stalls</li>
              <li><strong>Per-Organization Questions</strong> - Questions that repeat for each selected organization</li>
              <li><strong>General Questions</strong> - Standard questions asked once</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Drawer Form */}
      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={editingQuestion ? 'Edit Question' : 'Add New Question'}
      >
        <form
          onSubmit={handleAddQuestion}
          className="space-y-5"
        >
          {/* Question Text */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Question Text</label>
            <input
              name="text"
              value={form.text}
              onChange={handleInputChange}
              placeholder={form.type === 'organization_select' 
                ? "e.g., Which are the 5 stalls that you visited and liked the most?"
                : form.isPerOrganization 
                  ? "e.g., How would you rate your experience at {organization}?"
                  : "e.g., How was your overall experience at Career City?"}
              className="input-modern"
              required
            />
            {form.isPerOrganization && (
              <p className="text-xs text-gray-500 mt-1">
                Use <code className="bg-gray-100 px-1 rounded">{'{organization}'}</code> as placeholder for organization name
              </p>
            )}
          </div>

          {/* Question Category Selector */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Question Category</label>
            <div className="grid grid-cols-1 gap-3">
              {/* Organization Selection */}
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'organization_select', isPerOrganization: false, linkedToQuestionId: '' })}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  form.type === 'organization_select'
                    ? 'border-violet-500 bg-violet-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 ${form.type === 'organization_select' ? 'text-violet-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className={`font-semibold ${form.type === 'organization_select' ? 'text-violet-700' : 'text-gray-700'}`}>
                    Organization Selection
                  </span>
                </div>
                <p className="text-xs text-gray-500">Students pick their favorite stalls</p>
              </button>

              {/* Per-Organization Question */}
              <button
                type="button"
                onClick={() => {
                  if (organizationSelectQuestions.length > 0) {
                    setForm({ 
                      ...form, 
                      type: form.type === 'organization_select' ? 'text' : form.type,
                      isPerOrganization: true, 
                      linkedToQuestionId: organizationSelectQuestions[0]?.questionId || '' 
                    });
                  }
                }}
                disabled={organizationSelectQuestions.length === 0}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  form.isPerOrganization && form.type !== 'organization_select'
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : organizationSelectQuestions.length === 0
                      ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 ${form.isPerOrganization && form.type !== 'organization_select' ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className={`font-semibold ${form.isPerOrganization && form.type !== 'organization_select' ? 'text-emerald-700' : 'text-gray-700'}`}>
                    Per-Organization
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {organizationSelectQuestions.length === 0 
                    ? 'Add Organization Selection first'
                    : 'Repeats for each selected org'}
                </p>
              </button>

              {/* General Question */}
              <button
                type="button"
                onClick={() => setForm({ ...form, type: form.type === 'organization_select' ? 'text' : form.type, isPerOrganization: false, linkedToQuestionId: '' })}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  !form.isPerOrganization && form.type !== 'organization_select'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 ${!form.isPerOrganization && form.type !== 'organization_select' ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`font-semibold ${!form.isPerOrganization && form.type !== 'organization_select' ? 'text-blue-700' : 'text-gray-700'}`}>
                    General Question
                  </span>
                </div>
                <p className="text-xs text-gray-500">Asked once to the student</p>
              </button>
            </div>
          </div>
          
          {/* Answer Type - Only show for non-organization_select */}
          {form.type !== 'organization_select' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Answer Type</label>
              <CustomSelect
                options={QUESTION_TYPES.filter(t => t !== 'organization_select').map((type) => ({
                  value: type,
                  label: QUESTION_TYPE_LABELS[type],
                }))}
                value={form.type}
                onChange={(value) => setForm({ ...form, type: value as QuestionType })}
                placeholder="Select answer type"
              />
            </div>
          )}

          {/* Organization Selection Options */}
          {form.type === 'organization_select' && (
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 p-4 rounded-xl border border-violet-200">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-semibold text-violet-700">Organization Selection Settings</span>
              </div>
              
              {/* Selection Mode Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Selection Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, selectionMode: 'up_to' })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.selectionMode === 'up_to'
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Up to
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, selectionMode: 'exactly' })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.selectionMode === 'exactly'
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Exactly
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {form.selectionMode === 'up_to' 
                    ? 'Students can select 1 or more organizations, up to the maximum' 
                    : 'Students must select exactly this many organizations'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {form.selectionMode === 'up_to' ? 'Maximum' : 'Number of'} Organizations to Select
                </label>
                <input
                  type="number"
                  name="selectionCount"
                  value={form.selectionCount}
                  onChange={handleInputChange}
                  min="1"
                  max="10"
                  className="input-modern w-32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.selectionMode === 'up_to'
                    ? 'Students can select up to this many organizations from the list'
                    : 'Students must select exactly this many organizations from the list'}
                </p>
              </div>
            </div>
          )}

          {/* Per-Organization: Link to Selection Question */}
          {form.isPerOrganization && organizationSelectQuestions.length > 1 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Link to Organization Selection Question
              </label>
              <CustomSelect
                options={organizationSelectQuestions.map((q) => ({
                  value: q.questionId,
                  label: q.text.substring(0, 60) + (q.text.length > 60 ? '...' : ''),
                }))}
                value={form.linkedToQuestionId || ''}
                onChange={(value) => setForm({ ...form, linkedToQuestionId: value })}
                placeholder="Select the organization selection question"
              />
            </div>
          )}

          {/* Range/Scale Options */}
          {(form.type === 'range' || form.type === 'scale_text') && (
            <div className="grid grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Min Label</label>
                <input
                  name="minLabel"
                  value={form.minLabel}
                  onChange={handleInputChange}
                  placeholder="e.g. Not Helpful"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Max Label</label>
                <input
                  name="maxLabel"
                  value={form.maxLabel}
                  onChange={handleInputChange}
                  placeholder="e.g. Very Helpful"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Scale Max</label>
                <input
                  type="number"
                  name="scaleMax"
                  value={form.scaleMax}
                  onChange={handleInputChange}
                  min="3"
                  max="10"
                  className="input-modern"
                />
              </div>
            </div>
          )}

          {/* Multiple Choice / Checkbox Options */}
          {(form.type === 'multiplechoice' || form.type === 'checkbox' || form.type === 'multiplechoice_text') && (
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">Options</label>
                {(form.options || []).length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllOptions}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              
              {/* Guidance message */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> Add options one at a time, or paste multiple options separated by commas 
                  (e.g., <code className="bg-blue-100 px-1 rounded">Option 1, Option 2, Option 3</code>)
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="Enter option(s) - use commas to add multiple at once"
                  className="input-modern flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add
                </button>
              </div>
              
              {/* Options list */}
              {(form.options || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(form.options || []).map((option, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm">
                      <span className="text-gray-400 text-xs mr-1">{index + 1}.</span>
                      {option}
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">No options added yet</p>
              )}

              {/* Allow Other Option */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="allowOther"
                    checked={form.allowOther || false}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-700">Allow "Other" option</span>
                  <p className="text-xs text-gray-500">Adds an "Other" choice with a text input for custom answers</p>
                </div>
              </div>
            </div>
          )}

          {/* Combined Type: Follow-up Label */}
          {(form.type === 'scale_text' || form.type === 'multiplechoice_text') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Follow-up Label</label>
              <input
                name="followUpLabel"
                value={form.followUpLabel}
                onChange={handleInputChange}
                placeholder="e.g. Please explain your rating"
                className="input-modern"
              />
            </div>
          )}

          {/* Placeholder for text inputs */}
          {(form.type === 'text' || form.type === 'textarea' || form.type === 'number' || form.type === 'scale_text' || form.type === 'multiplechoice_text') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Placeholder Text</label>
              <input
                name="placeholder"
                value={form.placeholder}
                onChange={handleInputChange}
                placeholder="e.g. Enter your response here..."
                className="input-modern"
              />
            </div>
          )}
          
          <button
            type="submit"
            className="btn-accent w-full mt-2"
            disabled={loading}
          >
            {loading
              ? editingQuestion ? 'Updating...' : 'Adding...'
              : editingQuestion ? 'Update Question' : 'Add Question'}
          </button>
        </form>
      </Modal>

      {/* Questions List - Organized by Type */}
      <div className="space-y-6">
        {fetching ? (
          <div className="card-modern">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              Loading Questions...
            </h2>
             <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ListRowSkeleton key={i} />
                ))}
             </div>
          </div>
        ) : questions.length === 0 ? (
             <EmptyState
                title="No Questions Added"
                description="Create questions for students to answer about their experience."
                action={
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="btn-primary py-2 px-4 text-sm"
                  >
                    Add Question
                  </button>
                }
             />
        ) : (
        <>
        {/* Organization Selection Questions */}
        {orgSelectQuestions.length > 0 && (
          <div className="card-modern border-l-4 border-violet-500">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Organization Selection
              <span className="text-sm font-normal text-gray-400">({orgSelectQuestions.length})</span>
            </h2>
            <div className="space-y-4">
              {orgSelectQuestions.map((question, index) => (
                <div key={question.questionId}>
                  <div className="glass-hover p-5 rounded-xl border border-violet-200 bg-violet-50/30 flex items-center justify-between group transition-all duration-300">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1 mr-3 opacity-50 group-hover:opacity-100">
                      <button 
                        onClick={() => handleReorder(question.questionId, 'up', orgSelectQuestions)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button 
                        onClick={() => handleReorder(question.questionId, 'down', orgSelectQuestions)}
                        disabled={index === orgSelectQuestions.length - 1}
                        className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-lg">{question.text}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100 px-2 py-1 rounded-md">
                          {QUESTION_TYPE_LABELS[question.type]}
                        </span>
                        <span className="text-xs text-violet-500 bg-violet-100 px-2 py-1 rounded-md">
                          {question.selectionMode === 'up_to' ? 'Up to' : 'Exactly'} {question.selectionCount || 5} organizations
                        </span>
                      </div>
                      {/* Show linked questions */}
                      {getLinkedQuestions(question.questionId).length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-emerald-300">
                          <p className="text-xs font-semibold text-emerald-600 mb-1">
                            Follow-up questions for each selected organization:
                          </p>
                          <div className="space-y-1">
                            {getLinkedQuestions(question.questionId).map((linkedQ) => (
                              <p key={linkedQ.questionId} className="text-sm text-gray-600">
                                • {linkedQ.text}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleEdit(question)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(question.questionId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-Organization Questions */}
        {perOrgQuestionsFiltered.length > 0 && (
          <div className="card-modern border-l-4 border-emerald-500">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Per-Organization Questions
              <span className="text-sm font-normal text-gray-400">({perOrgQuestionsFiltered.length})</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">These questions repeat for each organization selected by the student</p>
            <div className="space-y-4">
              {perOrgQuestionsFiltered.map((question, index) => (
                <div
                  key={question.questionId}
                  className="glass-hover p-5 rounded-xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between group transition-all duration-300"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1 mr-3 opacity-50 group-hover:opacity-100">
                    <button 
                      onClick={() => handleReorder(question.questionId, 'up', perOrgQuestionsFiltered)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button 
                      onClick={() => handleReorder(question.questionId, 'down', perOrgQuestionsFiltered)}
                      disabled={index === perOrgQuestionsFiltered.length - 1}
                      className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-lg">{question.text}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
                        {QUESTION_TYPE_LABELS[question.type]}
                      </span>
                      <span className="text-xs text-emerald-500 bg-emerald-100 px-2 py-1 rounded-md flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Linked to org selection
                      </span>
                      {(question.type === 'range' || question.type === 'scale_text') && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          Scale: {question.minLabel || '1'} - {question.maxLabel || question.scaleMax || '5'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={() => handleEdit(question)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(question.questionId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General Questions */}
        <div className="card-modern">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            General Questions
            <span className="text-sm font-normal text-gray-400">
              ({generalQuestionsFiltered.length})
            </span>
          </h2>
          <div className="space-y-4">
            {generalQuestionsFiltered.map((question, index) => (
              <div
                key={question.questionId}
                className="glass-hover p-5 rounded-xl border border-white/60 flex items-center justify-between group transition-all duration-300"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-1 mr-3 opacity-50 group-hover:opacity-100">
                  <button 
                    onClick={() => handleReorder(question.questionId, 'up', generalQuestionsFiltered)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button 
                    onClick={() => handleReorder(question.questionId, 'down', generalQuestionsFiltered)}
                    disabled={index === generalQuestionsFiltered.length - 1}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg">{question.text}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </span>
                    {(question.type === 'range' || question.type === 'scale_text') && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        Scale: {question.minLabel || '1'} - {question.maxLabel || question.scaleMax || '5'}
                      </span>
                    )}
                    {(question.type === 'multiplechoice' || question.type === 'checkbox' || question.type === 'multiplechoice_text') && question.options && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        {question.options.length} options
                      </span>
                    )}
                    {question.allowOther && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                        + Other
                      </span>
                    )}
                    {(question.type === 'scale_text' || question.type === 'multiplechoice_text') && question.followUpLabel && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                        + follow-up
                      </span>
                    )}
                  </div>
                  {(question.type === 'multiplechoice' || question.type === 'checkbox' || question.type === 'multiplechoice_text') && question.options && question.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {question.options.slice(0, 5).map((opt, i) => (
                        <span key={i} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                          {opt}
                        </span>
                      ))}
                      {question.options.length > 5 && (
                        <span className="text-xs text-gray-400">+{question.options.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => handleEdit(question)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(question.questionId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {generalQuestionsFiltered.length === 0 && (
              <p className="text-gray-400 text-center py-8">No general questions added yet</p>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Question"
        message="Are you sure you want to delete this question? This will also delete all student answers associated with it."
        confirmText="Delete Question"
      />
    </div>
  );
}
