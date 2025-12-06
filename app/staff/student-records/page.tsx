'use client';

import { useState, useEffect } from 'react';
import { getAllStudents } from '../../../src/firestore/student';
import { getAllStudentFeedback, StudentFeedbackRecord } from '../../../src/firestore/studentFeedback';
import { getAllOrganizations } from '../../../src/firestore/organizations';
import { getAllVolunteerQuestions } from '../../../src/firestore/volunteerQuestions';
import { Student, Organization, VolunteerQuestion } from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { Skeleton } from '../../../src/lib/components/ui/Skeleton';
import { EmptyState } from '../../../src/lib/components/ui/EmptyState';

export default function StudentRecordsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<StudentFeedbackRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [questions, setQuestions] = useState<VolunteerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'visits' | 'feedback'>('visits');
  
  // Advanced Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filterHasFeedback, setFilterHasFeedback] = useState<'all' | 'yes' | 'no'>('all');
  const [filterVisitedOrg, setFilterVisitedOrg] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsData, feedbackData, orgsData, questionsData] = await Promise.all([
        getAllStudents(),
        getAllStudentFeedback(),
        getAllOrganizations(),
        getAllVolunteerQuestions(),
      ]);
      setStudents(studentsData);
      setFeedbackRecords(feedbackData);
      setOrganizations(orgsData);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load student records');
    } finally {
      setLoading(false);
    }
  };

  // Get organization name by ID
  const getOrgName = (orgId: string) => {
    const org = organizations.find(o => o.organizationId === orgId);
    return org?.name || orgId;
  };

  // Get question text by ID
  const getQuestionText = (questionId: string) => {
    const question = questions.find(q => q.questionId === questionId);
    return question?.text || questionId;
  };

  // Get feedback for a specific student
  const getStudentFeedback = (studentId: string) => {
    return feedbackRecords.find(f => f.studentId === studentId);
  };

  // Filter students by search term and advanced filters
  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      student.studentId.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      (student.fullName && student.fullName.toLowerCase().includes(searchLower));
    
    if (!matchesSearch) return false;

    const hasFeedback = !!getStudentFeedback(student.studentId);
    
    if (filterHasFeedback === 'yes' && !hasFeedback) return false;
    if (filterHasFeedback === 'no' && hasFeedback) return false;

    if (filterVisitedOrg) {
        const visited = student.visitedStalls || [];
        if (!visited.includes(filterVisitedOrg)) return false;
    }

    return true;
  });

  // Format date
  const formatDate = (date: Date | { toDate: () => Date } | undefined) => {
    if (!date) return 'N/A';
    const d = typeof date === 'object' && 'toDate' in date ? date.toDate() : date;
    return d.toLocaleString();
  };

  // Format response value
  const formatResponseValue = (value: string | number | string[]) => {
    if (Array.isArray(value)) {
      return value.map(v => {
        // Check if it's an organization ID
        const orgName = getOrgName(v);
        return orgName !== v ? orgName : v;
      }).join(', ');
    }
    // Check if it's an organization ID
    const orgName = getOrgName(String(value));
    return orgName !== String(value) ? orgName : String(value);
  };

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Image
            src="/favicon-optimized.png"
            alt="Career City Logo"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <h1 className="text-4xl font-extrabold text-gray-900">
            Student Records
          </h1>
        </div>
        <p className="text-gray-600 mt-2">
          View student stall visits and questionnaire responses
        </p>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative z-20">
          <div className="flex gap-2">
             <div className="relative flex-1">
                <input
                    type="text"
                    placeholder="Search by Student ID, Email, or Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-modern w-full pl-10"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 rounded-xl border transition-colors flex items-center gap-2 ${showFilters || filterHasFeedback !== 'all' || filterVisitedOrg ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
                {(filterHasFeedback !== 'all' || filterVisitedOrg) && (
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                )}
             </button>
          </div>

          {/* Filter Popover */}
          {showFilters && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 p-4 animate-fade-in-up">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Submitted?</label>
                        <div className="flex p-1 bg-gray-100 rounded-lg">
                            <button
                                onClick={() => setFilterHasFeedback('all')}
                                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${filterHasFeedback === 'all' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilterHasFeedback('yes')}
                                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${filterHasFeedback === 'yes' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setFilterHasFeedback('no')}
                                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${filterHasFeedback === 'no' ? 'bg-white shadow-sm text-red-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                No
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visited Organization</label>
                        <select
                            value={filterVisitedOrg}
                            onChange={(e) => setFilterVisitedOrg(e.target.value)}
                            className="input-modern py-1.5"
                        >
                            <option value="">All Organizations</option>
                            {organizations.map(org => (
                                <option key={org.organizationId} value={org.organizationId}>
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                    <button
                        onClick={() => {
                            setFilterHasFeedback('all');
                            setFilterVisitedOrg('');
                            setSearchTerm('');
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                        Reset All Filters
                    </button>
                </div>
            </div>
          )}
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{students.length}</div>
          <div className="text-sm text-gray-500">Total Students</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-3xl font-bold text-violet-600">{feedbackRecords.length}</div>
          <div className="text-sm text-gray-500">Feedback Submissions</div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student List Skeleton */}
          <div className="glass-card p-6">
             <Skeleton className="h-8 w-48 mb-4" />
             <div className="space-y-2">
                {Array.from({length: 6}).map((_, i) => (
                   <div key={i} className="p-4 rounded-xl border border-gray-200 bg-white/50">
                      <div className="flex justify-between items-start">
                         <div className="space-y-2 w-2/3">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-2/3" />
                         </div>
                         <div className="space-y-2 w-1/4 flex flex-col items-end">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
          {/* Detail Panel Skeleton */}
          <div className="glass-card p-6 hidden lg:block">
             <div className="space-y-6">
                <div className="border-b border-gray-200 pb-4 space-y-3">
                   <Skeleton className="h-8 w-3/4" />
                   <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                   </div>
                </div>
                <div className="flex gap-2">
                   <Skeleton className="h-10 w-32 rounded-lg" />
                   <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                <div className="space-y-3">
                   <Skeleton className="h-16 w-full rounded-lg" />
                   <Skeleton className="h-16 w-full rounded-lg" />
                   <Skeleton className="h-16 w-full rounded-lg" />
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student List */}
          <div className={`glass-card p-6 ${selectedStudent ? 'hidden lg:block' : 'block'}`}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Students ({filteredStudents.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <EmptyState
                  title="No Students Found"
                  description={searchTerm ? `No students match "${searchTerm}"` : "No students have registered yet."}
                />
              ) : (
                filteredStudents.map((student) => {
                  const hasFeedback = !!getStudentFeedback(student.studentId);
                  return (
                    <div
                      key={student.studentId}
                      onClick={() => setSelectedStudent(student)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        selectedStudent?.studentId === student.studentId
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-800">
                            {student.fullName || 'No Name'}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {student.studentId}
                          </div>
                          <div className="text-sm text-gray-500">
                            {student.email}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            <span className="font-semibold text-blue-600">
                              {student.visitedStalls?.length || 0}
                            </span>{' '}
                            <span className="text-gray-500">visits</span>
                          </div>
                          {hasFeedback && (
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full mt-1">
                              Feedback ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Student Detail Panel */}
          <div className={`glass-card p-6 ${selectedStudent ? 'block' : 'hidden lg:block'}`}>
            {selectedStudent ? (
              <div>
                {/* Mobile Back Button */}
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="lg:hidden mb-4 flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to List
                </button>

                {/* Student Info Header */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedStudent.fullName || 'No Name'}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold">Student ID:</span>{' '}
                      {selectedStudent.studentId}
                    </div>
                    <div>
                      <span className="font-semibold">Email:</span>{' '}
                      {selectedStudent.email}
                    </div>
                    <div>
                      <span className="font-semibold">Registered:</span>{' '}
                      {formatDate(selectedStudent.registeredAt)}
                    </div>
                    <div>
                      <span className="font-semibold">Total Scans:</span>{' '}
                      {selectedStudent.scanCount}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab('visits')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      activeTab === 'visits'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Stall Visits ({selectedStudent.visitedStalls?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('feedback')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      activeTab === 'feedback'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Feedback Responses
                  </button>
                </div>

                {/* Tab Content */}
                <div className="max-h-[400px] overflow-y-auto">
                  {activeTab === 'visits' ? (
                    <div className="space-y-2">
                      {selectedStudent.visitedStalls?.length > 0 ? (
                        selectedStudent.visitedStalls.map((stallId, index) => (
                          <div
                            key={stallId}
                            className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold">
                                {index + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-800">
                                  {getOrgName(stallId)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {stallId}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title="No Visits Recorded"
                          description="This student hasn't visited any stalls yet."
                          className="py-8"
                        />
                      )}
                    </div>
                  ) : (
                    <div>
                      {(() => {
                        const feedback = getStudentFeedback(selectedStudent.studentId);
                        if (!feedback) {
                          return (
                            <EmptyState
                              title="No Feedback Submitted"
                              description="This student hasn't submitted the feedback questionnaire yet."
                              className="py-8"
                            />
                          );
                        }
                        return (
                          <div className="space-y-4">
                            <div className="text-xs text-gray-500 mb-2">
                              Submitted: {formatDate(feedback.createdAt)}
                            </div>
                            {Object.entries(feedback.responses).map(([questionId, value]) => (
                              <div
                                key={questionId}
                                className="p-4 bg-violet-50 rounded-lg border border-violet-100"
                              >
                                <div className="text-sm font-semibold text-gray-700 mb-2">
                                  {getQuestionText(questionId)}
                                </div>
                                <div className="text-gray-800">
                                  {formatResponseValue(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No Student Selected"
                description="Select a student from the list to view their full details and activity."
                className="h-full flex flex-col justify-center"
                icon={
                  <svg
                    className="w-12 h-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
