'use client';

import { useState, useEffect } from 'react';
import FeedbackForm from '../../../src/components/volunteer/FeedbackForm';
import { addOrganizationFeedback } from '../../../src/firestore/organizationFeedback';
import { getAllOrganizationFeedbackQuestions } from '../../../src/firestore/organizationFeedbackQuestions';
import { OrganizationFeedbackQuestion } from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackPage() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<OrganizationFeedbackQuestion[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log('Fetching organization feedback questions...');
        const data = await getAllOrganizationFeedbackQuestions();
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
    organizationId: string,
    responses: Record<string, string>
  ) => {
    setLoading(true);
    try {
      await addOrganizationFeedback(organizationId, responses);
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
        title="Organization Feedback Form"
        idLabel="Organization ID"
        idPlaceholder="Enter organization ID"
        questions={questions}
        submitButtonText={loading ? 'Submitting...' : 'Submit Feedback'}
        onSubmit={handleSubmit}
      />
    </>
  );
}
