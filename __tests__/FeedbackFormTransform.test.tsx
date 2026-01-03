
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeedbackForm, { Question } from '../src/components/volunteer/FeedbackForm';

// Mock haptics
jest.mock('../src/lib/haptics', () => ({
  haptics: {
    impact: jest.fn(),
    success: jest.fn(),
    select: jest.fn(),
    tap: jest.fn(),
  },
}));

describe('FeedbackForm', () => {
  const mockSubmit = jest.fn();
  
  const mockQuestions: Question[] = [
    {
      questionId: 'q1',
      text: 'How was your day?',
      type: 'text',
    },
    {
      questionId: 'q2',
      text: 'Rate the event',
      type: 'range',
      scaleMax: 5,
    },
    {
      questionId: 'q3',
      text: 'Any comments?',
      type: 'scale_text',
      scaleMax: 5,
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transform question IDs to readable keys on submit', async () => {
    render(
      <FeedbackForm
        title="Test Form"
        idLabel="Student ID"
        idPlaceholder="Enter ID"
        questions={mockQuestions}
        submitButtonText="Submit"
        onSubmit={mockSubmit}
      />
    );

    // Fill ID
    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: '123' } });

    // Fill Text Answer
    fireEvent.change(screen.getByLabelText('How was your day?'), { target: { value: 'Good' } });

    // Fill Range Answer (Radio button)
    // The range renderer uses name=`${questionId}` (or slightly modified)
    // Logic: name="q2", value="5"
    const radios = screen.getAllByRole('radio');
    const rangeRadio = radios.find(el => (el as HTMLInputElement).name === 'q2' && (el as HTMLInputElement).value === '5');
    if (rangeRadio) fireEvent.click(rangeRadio);

    // Fill Scale+Text Answer
    // Scale part: name="q3_scale", value="4"
    const scaleTextRadio = radios.find(el => (el as HTMLInputElement).name === 'q3_scale' && (el as HTMLInputElement).value === '4');
    if (scaleTextRadio) fireEvent.click(scaleTextRadio);

    // Text part: The label is typically 'Additional comments (optional)' for the text area in combined types
    // But since we can't easily query by that generic label, we can query by placeholder
    const textPart = screen.getByPlaceholderText('Please elaborate...');
    fireEvent.change(textPart, { target: { value: 'Nice event' } });

    // Submit
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });

    const submittedResponses = mockSubmit.mock.calls[0][1];
    
    // Check keys
    expect(submittedResponses).toHaveProperty('how-was-your-day', 'Good');
    expect(submittedResponses).toHaveProperty('rate-the-event', '5');
    
    // Check combined keys
    // The implementation logic for suffixes:
    // q3_scale -> q3 matches 'Any comments?' -> any-comments-scale
    // q3_text -> q3 matches 'Any comments?' -> any-comments-text
    expect(submittedResponses).toHaveProperty('any-comments-scale', '4');
    expect(submittedResponses).toHaveProperty('any-comments-text', 'Nice event');
  });
});
