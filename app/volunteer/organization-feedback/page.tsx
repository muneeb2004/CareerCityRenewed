'use client';

import { useState } from 'react';
import FeedbackForm from '@/lib/components/volunteer/FeedbackForm';
import { addOrganizationFeedback } from '@/lib/firestore/organizationFeedback';
import toast, { Toaster } from 'react-hot-toast';

export default function OrganizationFeedbackPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (organizationId: string, feedback: string) => {
    setLoading(true);
    try {
      await addOrganizationFeedback(organizationId, feedback);
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
        feedbackLabel="Feedback"
        feedbackPlaceholder="Enter feedback for the organization"
        submitButtonText={loading ? 'Submitting...' : 'Submit Feedback'}
        onSubmit={handleSubmit}
      />
    </>
  );
}
