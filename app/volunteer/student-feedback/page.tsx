'use client';

import { useState, useEffect } from 'react';
import FeedbackForm from '../../../src/lib/components/volunteer/FeedbackForm';
import { addStudentFeedback } from '../../../src/lib/firestore/studentFeedback';
import { getAllVolunteerQuestions } from '../../../src/lib/firestore/volunteerQuestions'; // Note: Using getAllVolunteerQuestions as per previous turn's context
import { VolunteerQuestion } from '../../../src/lib/types';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<VolunteerQuestion[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log('Fetching student questions...');
        const data = await getAllVolunteerQuestions();
        console.log('Fetched questions:', data);
        setQuestions(data);
      } catch (error) {
        console.error('Error fetching questions:', error);
        toast.error('Failed to load questions.');
      }
    };
    fetchQuestions();
  }, []);

  const handleSubmit = async (
    studentId: string,
    responses: Record<string, string>
  ) => {
    setLoading(true);
    try {
      await addStudentFeedback(studentId, responses);
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
        questions={questions}
        submitButtonText={loading ? 'Submitting...' : 'Submit Feedback'}
        onSubmit={handleSubmit}
      />
    </>
  );
}