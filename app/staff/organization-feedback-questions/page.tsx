'use client';

import { useState, useEffect } from 'react';
import {
  createOrganizationFeedbackQuestion,
  getAllOrganizationFeedbackQuestions,
  updateOrganizationFeedbackQuestion,
  deleteOrganizationFeedbackQuestion,
} from '@/firestore/organizationFeedbackQuestions';
import {
  OrganizationFeedbackQuestion,
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from '@/lib/components/ui/SortableItem';

export default function OrganizationFeedbackQuestionManagement() {
  const [questions, setQuestions] = useState<OrganizationFeedbackQuestion[]>([]);
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
    allowOther: false,
  });
  const [optionInput, setOptionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<OrganizationFeedbackQuestion | null>(null);
  
  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const data = await getAllOrganizationFeedbackQuestions();
      setQuestions(data);
    } catch (error) {
      console.error(error);
      showError("Failed to load questions");
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'scaleMax') {
      setForm({ ...form, [name]: parseInt(value) || 5 });
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
    const newOptions = [...(form.options || [])];
    newOptions.splice(index, 1);
    setForm({ ...form, options: newOptions });
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
      allowOther: false,
    });
    setOptionInput('');
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    console.log('handleAddQuestion started'); // Debug log
    e.preventDefault();
    setLoading(true);
    try {
      if (editingQuestion) {
        await updateOrganizationFeedbackQuestion(editingQuestion.questionId, form);
        showSuccess('Question updated!');
        setEditingQuestion(null);
          } else {
            console.log('Attempting to create question...'); // Debug log
            await createOrganizationFeedbackQuestion(form);
            console.log('createOrganizationFeedbackQuestion resolved.'); // Debug log
            showSuccess('Question added!');
          }
          resetForm();
          setShowAddForm(false);
          fetchQuestions();
        } catch (err: unknown) {
          console.error('Error caught in handleAddQuestion:', err); // Debug log
          if (err instanceof Error) {
            showError(`Failed to save question: ${err.message}`);
          } else {
            showError('An unknown error occurred.');
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
      scaleMax: question.scaleMax || 5,
      options: question.options || [],
      followUpLabel: question.followUpLabel || '',
      placeholder: question.placeholder || '',
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
      await deleteOrganizationFeedbackQuestion(deleteId);
      showSuccess('Question deleted!');
      fetchQuestions();
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        showError(`Failed to delete question: ${err.message}`);
      } else {
        showError('An unknown error occurred while deleting the question.');
      }
    }
  };

  // Reorder questions
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.questionId === active.id);
        const newIndex = items.findIndex((item) => item.questionId === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update order in backend for all affected items
        // Optimistic update first
        const updates = newItems.map((item, index) => 
            updateOrganizationFeedbackQuestion(item.questionId, { order: index })
        );
        
        Promise.all(updates).catch(err => {
            console.error("Failed to update order", err);
            showError("Failed to save new order");
            fetchQuestions(); // Revert on error
        });

        return newItems;
      });
    }
  };

  // Get sorted questions
  const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

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
            <CustomSelect
              options={QUESTION_TYPES.map((type) => ({
                value: type,
                label: QUESTION_TYPE_LABELS[type],
              }))}
              value={form.type}
              onChange={(value) => setForm({ ...form, type: value as QuestionType })}
              placeholder="Select answer type"
            />
          </div>

          {/* Range/Scale Options */}
          {(form.type === 'range' || form.type === 'scale_text') && (
            <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
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
                  placeholder="Enter option(s)"
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
                    onChange={(e) => setForm({ ...form, allowOther: e.target.checked })}
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
            className="btn-accent w-full mt-4"
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
      </Modal>

      {/* Questions List */}
      <div className="card-modern">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Existing Questions
             {!fetching && <span className="text-sm font-normal text-gray-400 ml-2">({sortedQuestions.length})</span>}
        </h2>
                <div className="space-y-4">
                  {fetching ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <ListRowSkeleton key={i} />
                    ))
                  ) : sortedQuestions.length === 0 ? (
                    <EmptyState
                      title="No Questions Added"
                      description="Create the first feedback question for organizations to answer."
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={sortedQuestions.map(q => q.questionId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedQuestions.map((question, index) => (
                        <SortableItem key={question.questionId} id={question.questionId}>
                          <div
                            className="glass-hover p-5 rounded-xl border border-white/60 flex items-center justify-between group transition-all duration-300"
                          >
                            {/* Drag Handle */}
                            <div className="mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" /></svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-800 text-lg">{question.text}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-1 rounded-md">
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
                              {/* Show options preview for multiple choice types */}
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
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                  )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Question"
        message="Are you sure you want to delete this question? This will also delete all feedback answers associated with it."
        confirmText="Delete Question"
      />
    </div>
  );
}
