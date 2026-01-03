'use client';

import { useState, useEffect } from 'react';
import { addStudentFeedback, hasStudentSubmittedFeedback } from '../../../src/actions/feedback';
import { getAllVolunteerQuestions } from '../../../src/actions/questions';
import { getAllOrganizations } from '../../../src/actions/organizations';
import { VolunteerQuestion, Organization, QuestionType } from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';

// Form step types
type FormStep = 'student-id' | 'org-selection' | 'per-org-questions' | 'general-questions' | 'complete';

export default function StudentFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<VolunteerQuestion[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  // Form state
  const [studentId, setStudentId] = useState('');
  const [currentStep, setCurrentStep] = useState<FormStep>('student-id');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [currentOrgIndex, setCurrentOrgIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});

  // Derived question categories (sorted by order)
  const orgSelectQuestion = questions.find(q => q.type === 'organization_select');
  const perOrgQuestions = questions
    .filter(q => q.isPerOrganization)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const generalQuestions = questions
    .filter(q => q.type !== 'organization_select' && !q.isPerOrganization)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching student questions and organizations...');
        const [questionsData, orgsData] = await Promise.all([
          getAllVolunteerQuestions(),
          getAllOrganizations(),
        ]);
        console.log('Fetched questions:', questionsData);
        console.log('Fetched organizations:', orgsData);
        // Cast to expected types as actions return compatible structures
        setQuestions(questionsData as unknown as VolunteerQuestion[]);
        setOrganizations(orgsData as unknown as Organization[]);
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

  const handleOrgSelection = (orgId: string, checked: boolean) => {
    const maxSelection = orgSelectQuestion?.selectionCount || 5;
    const selectionMode = orgSelectQuestion?.selectionMode || 'up_to';
    if (checked) {
      if (selectedOrgs.length < maxSelection) {
        setSelectedOrgs([...selectedOrgs, orgId]);
      } else {
        toast.error(`You can only select ${selectionMode === 'up_to' ? 'up to ' : ''}${maxSelection} organizations`);
      }
    } else {
      setSelectedOrgs(selectedOrgs.filter(id => id !== orgId));
    }
  };

  const proceedToNextStep = async () => {
    if (currentStep === 'student-id') {
      if (!studentId.trim()) {
        toast.error('Please enter the student ID');
        return;
      }
      // Validate format: 2 letters + 5 digits (e.g., ab12345)
      const idRegex = /^[a-zA-Z]{2}\d{5}$/;
      if (!idRegex.test(studentId.trim())) {
        toast.error('Student ID must be 2 letters followed by 5 digits (e.g., ab12345)');
        return;
      }
      
      // Check if student has already submitted feedback
      setLoading(true);
      try {
        const alreadySubmitted = await hasStudentSubmittedFeedback(studentId.toLowerCase());
        if (alreadySubmitted) {
          toast.error('This student has already submitted feedback');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error checking feedback status:', error);
        toast.error('Failed to verify feedback status. Please try again.');
        setLoading(false);
        return;
      }
      setLoading(false);
      
      // If there's an org selection question, go to that first
      if (orgSelectQuestion) {
        setCurrentStep('org-selection');
      } else if (generalQuestions.length > 0) {
        setCurrentStep('general-questions');
      } else {
        handleSubmit();
      }
    } else if (currentStep === 'org-selection') {
      const maxSelection = orgSelectQuestion?.selectionCount || 5;
      const selectionMode = orgSelectQuestion?.selectionMode || 'up_to';
      
      // For "up_to" mode, just need at least 1 selection
      // For "exactly" mode, need exactly the specified count
      if (selectionMode === 'up_to') {
        if (selectedOrgs.length === 0) {
          toast.error('Please select at least 1 organization');
          return;
        }
      } else {
        if (selectedOrgs.length !== maxSelection) {
          toast.error(`Please select exactly ${maxSelection} organizations`);
          return;
        }
      }
      // Store org selection response
      handleResponseChange(orgSelectQuestion!.questionId, selectedOrgs);
      
      if (perOrgQuestions.length > 0) {
        setCurrentOrgIndex(0);
        setCurrentStep('per-org-questions');
      } else if (generalQuestions.length > 0) {
        setCurrentStep('general-questions');
      } else {
        handleSubmit();
      }
    } else if (currentStep === 'per-org-questions') {
      // Move to next organization or general questions
      if (currentOrgIndex < selectedOrgs.length - 1) {
        setCurrentOrgIndex(currentOrgIndex + 1);
      } else if (generalQuestions.length > 0) {
        setCurrentStep('general-questions');
      } else {
        handleSubmit();
      }
    } else if (currentStep === 'general-questions') {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Store studentId in lowercase to match the student records format
      await addStudentFeedback(studentId.toLowerCase(), responses);
      toast.success('Feedback submitted successfully!');
      setCurrentStep('complete');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStudentId('');
    setCurrentStep('student-id');
    setSelectedOrgs([]);
    setCurrentOrgIndex(0);
    setResponses({});
  };

  // Get current organization name for per-org questions
  const getCurrentOrgName = () => {
    const orgId = selectedOrgs[currentOrgIndex];
    const org = organizations.find(o => o.organizationId === orgId);
    return org?.name || orgId;
  };

  // Render scale/range selector
  const renderScale = (question: VolunteerQuestion, fieldName: string) => {
    const max = question.scaleMax || 5;
    const values = Array.from({ length: max }, (_, i) => i + 1);
    
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

  // Render multiple choice (radio)
  const renderMultipleChoice = (question: VolunteerQuestion, fieldName: string) => {
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
  const renderCheckbox = (question: VolunteerQuestion, fieldName: string) => {
    const selected = (responses[fieldName] as string[]) || [];
    const otherFieldName = `${fieldName}_other`;
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
              onChange={(e) => {
                const current = (responses[fieldName] as string[]) || [];
                if (e.target.checked) {
                  handleResponseChange(fieldName, [...current, option]);
                } else {
                  handleResponseChange(fieldName, current.filter((o) => o !== option));
                }
              }}
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
                onChange={(e) => {
                  const current = (responses[fieldName] as string[]) || [];
                  if (e.target.checked) {
                    handleResponseChange(fieldName, [...current, '__other__']);
                  } else {
                    handleResponseChange(fieldName, current.filter((o) => o !== '__other__'));
                  }
                }}
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
  const renderQuestion = (question: VolunteerQuestion, fieldName: string, orgName?: string) => {
    // Replace {organization} placeholder with actual org name
    const questionText = orgName 
      ? question.text.replace(/{organization}/g, orgName)
      : question.text;

    const renderInput = () => {
      switch (question.type) {
        case 'range':
          return renderScale(question, fieldName);
        case 'number':
          return (
            <input
              type="number"
              value={(responses[fieldName] as string) || ''}
              onChange={(e) => handleResponseChange(fieldName, e.target.value)}
              placeholder={question.placeholder || 'Enter a number'}
              className="input-modern"
              min="0"
              required
            />
          );
        case 'multiplechoice':
          return renderMultipleChoice(question, fieldName);
        case 'checkbox':
          return renderCheckbox(question, fieldName);
        case 'text':
          return (
            <input
              type="text"
              value={(responses[fieldName] as string) || ''}
              onChange={(e) => handleResponseChange(fieldName, e.target.value)}
              placeholder={question.placeholder || ''}
              className="input-modern"
              required
            />
          );
        case 'textarea':
          return (
            <textarea
              value={(responses[fieldName] as string) || ''}
              onChange={(e) => handleResponseChange(fieldName, e.target.value)}
              placeholder={question.placeholder || ''}
              className="input-modern min-h-[120px] resize-y"
              required
            />
          );
        case 'scale_text':
          return (
            <div className="space-y-4">
              {renderScale(question, `${fieldName}_scale`)}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  {question.followUpLabel || 'Additional comments (optional)'}
                </label>
                <textarea
                  value={(responses[`${fieldName}_text`] as string) || ''}
                  onChange={(e) => handleResponseChange(`${fieldName}_text`, e.target.value)}
                  placeholder={question.placeholder || 'Please elaborate...'}
                  className="input-modern min-h-20 resize-y"
                />
              </div>
            </div>
          );
        case 'multiplechoice_text':
          return (
            <div className="space-y-4">
              {renderMultipleChoice(question, `${fieldName}_choice`)}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  {question.followUpLabel || 'Additional comments (optional)'}
                </label>
                <textarea
                  value={(responses[`${fieldName}_text`] as string) || ''}
                  onChange={(e) => handleResponseChange(`${fieldName}_text`, e.target.value)}
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
              value={(responses[fieldName] as string) || ''}
              onChange={(e) => handleResponseChange(fieldName, e.target.value)}
              className="input-modern"
              required
            />
          );
      }
    };

    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <label className="block text-base font-bold text-gray-900 mb-3">
          {questionText}
        </label>
        {renderInput()}
      </div>
    );
  };

  // Progress calculation
  const getProgress = () => {
    const steps = ['student-id'];
    if (orgSelectQuestion) steps.push('org-selection');
    if (perOrgQuestions.length > 0 && selectedOrgs.length > 0) {
      for (let i = 0; i < selectedOrgs.length; i++) {
        steps.push(`per-org-${i}`);
      }
    }
    if (generalQuestions.length > 0) steps.push('general-questions');
    
    let currentIndex = 0;
    if (currentStep === 'student-id') currentIndex = 0;
    else if (currentStep === 'org-selection') currentIndex = 1;
    else if (currentStep === 'per-org-questions') currentIndex = 2 + currentOrgIndex;
    else if (currentStep === 'general-questions') currentIndex = steps.length - 1;
    else if (currentStep === 'complete') currentIndex = steps.length;
    
    return Math.round((currentIndex / steps.length) * 100);
  };

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
              className="w-auto h-20 sm:h-32 object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
            Student Feedback Form
          </h1>

          {/* Progress bar */}
          {currentStep !== 'complete' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Progress</span>
                <span>{getProgress()}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-linear-to-r from-blue-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          )}

          {/* Step: Student ID */}
          {currentStep === 'student-id' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="studentId" className="block text-sm font-semibold text-gray-700 mb-2">
                  Student ID
                </label>
                <input
                  type="text"
                  id="studentId"
                  value={studentId}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().slice(0, 7);
                    setStudentId(value);
                  }}
                  placeholder="e.g., ab12345"
                  className="input-modern"
                  maxLength={7}
                  pattern="[a-zA-Z]{2}\d{5}"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: 2 letters + 5 digits ({studentId.length}/7 characters)
                </p>
              </div>
              <button
                onClick={proceedToNextStep}
                disabled={!/^[a-zA-Z]{2}\d{5}$/.test(studentId)}
                className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step: Organization Selection */}
          {currentStep === 'org-selection' && orgSelectQuestion && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <label className="block text-base font-bold text-gray-900 mb-1">
                  {orgSelectQuestion.text}
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  {orgSelectQuestion.selectionMode === 'exactly' 
                    ? `Select exactly ${orgSelectQuestion.selectionCount || 5} organizations`
                    : `Select up to ${orgSelectQuestion.selectionCount || 5} organizations`
                  } ({selectedOrgs.length}/{orgSelectQuestion.selectionCount || 5} selected)
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {organizations.map((org) => (
                    <label
                      key={org.organizationId}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedOrgs.includes(org.organizationId)
                          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                          : 'border-gray-200 hover:border-violet-300 hover:shadow-sm'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrgs.includes(org.organizationId)}
                        onChange={(e) => handleOrgSelection(org.organizationId, e.target.checked)}
                        className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                      />
                      <div className="ml-3">
                        <span className="font-medium text-gray-900">{org.name}</span>
                        <span className="text-sm text-gray-500 ml-2">• Booth {org.boothNumber}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={proceedToNextStep}
                disabled={
                  orgSelectQuestion.selectionMode === 'exactly'
                    ? selectedOrgs.length !== (orgSelectQuestion.selectionCount || 5)
                    : selectedOrgs.length === 0
                }
                className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step: Per-Organization Questions */}
          {currentStep === 'per-org-questions' && perOrgQuestions.length > 0 && (
            <div className="space-y-6">
              {/* Organization header */}
              <div className="bg-linear-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Organization {currentOrgIndex + 1} of {selectedOrgs.length}</p>
                    <h2 className="text-xl font-bold text-emerald-800">{getCurrentOrgName()}</h2>
                  </div>
                  <div className="flex gap-1">
                    {selectedOrgs.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full ${
                          idx < currentOrgIndex ? 'bg-emerald-500' : 
                          idx === currentOrgIndex ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-org questions */}
              {perOrgQuestions.map((question) => {
                const fieldName = `${question.questionId}_org_${selectedOrgs[currentOrgIndex]}`;
                return (
                  <div key={question.questionId}>
                    {renderQuestion(question, fieldName, getCurrentOrgName())}
                  </div>
                );
              })}

              <button
                onClick={proceedToNextStep}
                className="btn-primary w-full text-lg"
              >
                {currentOrgIndex < selectedOrgs.length - 1 
                  ? `Next Organization (${currentOrgIndex + 2}/${selectedOrgs.length})`
                  : generalQuestions.length > 0 
                    ? 'Continue to General Questions'
                    : 'Submit Feedback'}
              </button>
            </div>
          )}

          {/* Step: General Questions */}
          {currentStep === 'general-questions' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-700 font-medium">General Questions</p>
              </div>

              {generalQuestions.map((question) => (
                <div key={question.questionId}>
                  {renderQuestion(question, question.questionId)}
                </div>
              ))}

              <button
                onClick={proceedToNextStep}
                disabled={loading}
                className="btn-primary w-full text-lg"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          )}

          {/* Step: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
              <p className="text-gray-600">Your feedback has been submitted successfully.</p>
              <button
                onClick={resetForm}
                className="btn-primary mt-4"
              >
                Submit Another Response
              </button>
            </div>
          )}

          {/* No questions state */}
          {questions.length === 0 && currentStep === 'student-id' && (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 mt-6">
              <p className="text-gray-500 font-medium">No questions have been set by the staff yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
