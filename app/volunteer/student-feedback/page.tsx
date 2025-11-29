'use client';

import { useState } from 'react';
import FeedbackForm from '@/lib/components/volunteer/FeedbackForm';
import { addStudentFeedback } from '@/lib/firestore/studentFeedback';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentFeedbackPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (studentId: string, feedback: string) => {
    setLoading(true);
    try {
      await addStudentFeedback(studentId, feedback);
      toast.success('Feedback submitted successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <FeedbackForm
        title="Student Feedback Form"
        idLabel="Student ID"
        idPlaceholder="Enter student ID"
        feedbackLabel="Feedback"
        feedbackPlaceholder="Enter feedback for the student"
        submitButtonText={loading ? 'Submitting...' : 'Submit Feedback'}
        onSubmit={handleSubmit}
      />
    </>
  );
}
