'use client';

import { useState, useEffect, useRef } from 'react';
import { addOrganizationFeedback, hasOrganizationSubmittedFeedback } from '../../../src/firestore/organizationFeedback';
import { getAllOrganizationFeedbackQuestions } from '../../../src/firestore/organizationFeedbackQuestions';
import { getAllOrganizations } from '../../../src/firestore/organizations';
import { OrganizationFeedbackQuestion, Organization } from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';

export default function OrganizationFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<OrganizationFeedbackQuestion[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  
  // Searchable dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.boothNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching organization feedback questions and organizations...');
        const [questionsData, orgsData] = await Promise.all([
          getAllOrganizationFeedbackQuestions(),
          getAllOrganizations(),
        ]);
        console.log('Fetched questions:', questionsData);
        console.log('Fetched organizations:', orgsData);
        setQuestions(questionsData);
        setOrganizations(orgsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load form data.');
      }
    };
    fetchData();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }
    setLoading(true);
    try {
      // Check if organization has already submitted feedback
      const alreadySubmitted = await hasOrganizationSubmittedFeedback(selectedOrgId);
      if (alreadySubmitted) {
        toast.error('This organization has already submitted feedback');
        setLoading(false);
        return;
      }
      
      await addOrganizationFeedback(selectedOrgId, responses);
      toast.success('Feedback submitted successfully!');
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedOrgId('');
    setSearchQuery('');
    setResponses({});
    setSubmitted(false);
  };

  const handleSelectOrg = (org: Organization) => {
    setSelectedOrgId(org.organizationId);
    setSearchQuery(org.name);
    setIsDropdownOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedOrgId('');
    setSearchQuery('');
  };

  const selectedOrg = organizations.find(o => o.organizationId === selectedOrgId);

  // Render scale/range selector
  const renderScale = (question: OrganizationFeedbackQuestion) => {
    const max = question.scaleMax || 5;
    const values = Array.from({ length: max }, (_, i) => i + 1);
    
    return (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
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
                name={question.questionId}
                value={value}
                checked={responses[question.questionId] === String(value)}
                onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
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

  // Render multiple choice (radio)
  const renderMultipleChoice = (question: OrganizationFeedbackQuestion, fieldName?: string) => {
    const name = fieldName || question.questionId;
    const otherFieldName = `${name}_other`;
    const isOtherSelected = responses[name] === '__other__';
    
    return (
      <div className="space-y-2">
        {(question.options || []).map((option) => (
          <label
            key={option}
            className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200 has-checked:border-blue-500 has-checked:bg-blue-50"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={responses[name] === option}
              onChange={(e) => handleResponseChange(name, e.target.value)}
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
                name={name}
                value="__other__"
                checked={isOtherSelected}
                onChange={(e) => handleResponseChange(name, e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
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
  const renderCheckbox = (question: OrganizationFeedbackQuestion) => {
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

  // Render question based on type
  const renderQuestion = (question: OrganizationFeedbackQuestion) => {
    switch (question.type) {
      case 'range':
        return renderScale(question);
      case 'number':
        return (
          <input
            type="number"
            value={(responses[question.questionId] as string) || ''}
            onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
            placeholder={question.placeholder || 'Enter a number'}
            className="input-modern"
            min="0"
            required
          />
        );
      case 'multiplechoice':
        return renderMultipleChoice(question);
      case 'checkbox':
        return renderCheckbox(question);
      case 'text':
        return (
          <input
            type="text"
            value={(responses[question.questionId] as string) || ''}
            onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
            placeholder={question.placeholder || ''}
            className="input-modern"
            required
          />
        );
      case 'textarea':
        return (
          <textarea
            value={(responses[question.questionId] as string) || ''}
            onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
            placeholder={question.placeholder || ''}
            className="input-modern min-h-[120px] resize-y"
            required
          />
        );
      case 'scale_text':
        return (
          <div className="space-y-4">
            {renderScale(question)}
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
      case 'multiplechoice_text':
        return (
          <div className="space-y-4">
            {renderMultipleChoice(question, `${question.questionId}_choice`)}
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
      default:
        return (
          <input
            type="text"
            value={(responses[question.questionId] as string) || ''}
            onChange={(e) => handleResponseChange(question.questionId, e.target.value)}
            className="input-modern"
            required
          />
        );
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
        <Toaster position="top-center" />
        <div className="w-full max-w-2xl">
          <div className="card-modern text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Thank You!</h2>
            <p className="text-gray-600">Your feedback has been submitted successfully.</p>
            <button
              onClick={resetForm}
              className="btn-primary mt-4"
            >
              Submit Another Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <Toaster position="top-center" />
      <div className="w-full max-w-2xl">
        <div className="card-modern">
          <div className="flex justify-center mb-6">
            <Image
              src="/favicon-optimized.png"
              alt="Career City Logo"
              width={512}
              height={512}
              className="w-auto h-32 object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-extrabold text-center mb-8 bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
            Organization Feedback Form
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Selection - Searchable Dropdown */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative z-40">
              <label className="block text-base font-bold text-gray-800 mb-3">
                Select Your Organization
              </label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedOrgId && e.target.value !== selectedOrg?.name) {
                        setSelectedOrgId('');
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Type to search organizations..."
                    className="input-modern w-full pr-10"
                  />
                  {selectedOrgId ? (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {isDropdownOpen && (
                  <div className="absolute z-100 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto overflow-x-hidden" style={{ isolation: 'isolate' }}>
                    {filteredOrganizations.length === 0 ? (
                      <div className="p-6 text-center">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-gray-500 font-medium">No organizations found</p>
                        <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredOrganizations.map((org, index) => (
                          <button
                            key={org.organizationId}
                            type="button"
                            onClick={() => handleSelectOrg(org)}
                            className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                              selectedOrgId === org.organizationId 
                                ? 'bg-linear-to-r from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/30' 
                                : 'hover:bg-violet-50/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className={`font-semibold truncate ${
                                  selectedOrgId === org.organizationId ? 'text-white' : 'text-gray-800'
                                }`}>
                                  {org.name}
                                </div>
                                <div className={`text-sm flex items-center gap-2 mt-0.5 ${
                                  selectedOrgId === org.organizationId ? 'text-white/80' : 'text-gray-500'
                                }`}>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                    selectedOrgId === org.organizationId 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-violet-100 text-violet-700'
                                  }`}>
                                    Booth {org.boothNumber}
                                  </span>
                                  <span className="truncate">{org.industry}</span>
                                </div>
                              </div>
                              {selectedOrgId === org.organizationId && (
                                <svg className="w-5 h-5 text-white shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected organization details */}
              {selectedOrg && (
                <div className="mt-4 p-4 bg-linear-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-200/50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-violet-800 text-lg">{selectedOrg.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700">
                          Booth {selectedOrg.boothNumber}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                          {selectedOrg.industry}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-violet-200/50 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Contact Person</p>
                      <p className="text-sm text-gray-700 font-medium">{selectedOrg.contactPerson}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Category</p>
                      <p className="text-sm text-gray-700 font-medium">{selectedOrg.category || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500 font-medium">No questions have been set by the staff yet.</p>
              </div>
            ) : (
              [...questions].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((question) => (
                <div key={question.questionId} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md">
                  <label className="block text-base font-bold text-gray-800 mb-3">
                    {question.text}
                  </label>
                  {renderQuestion(question)}
                </div>
              ))
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !selectedOrgId}
                className="btn-primary w-full text-lg shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
