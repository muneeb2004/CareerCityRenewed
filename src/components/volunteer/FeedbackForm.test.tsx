import { render, screen, fireEvent } from '@testing-library/react';
import FeedbackForm from './FeedbackForm';

describe('FeedbackForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    render(
      <FeedbackForm
        title="Test Form"
        idLabel="Test ID"
        idPlaceholder="Enter Test ID"
        feedbackLabel="Test Feedback"
        feedbackPlaceholder="Enter Test Feedback"
        submitButtonText="Submit"
        onSubmit={mockOnSubmit}
      />
    );
  });

  it('renders the form correctly', () => {
    expect(screen.getByText('Test Form')).toBeInTheDocument();
    expect(screen.getByLabelText('Test ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Feedback')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('calls the onSubmit function with the correct data when the form is submitted', () => {
    const idInput = screen.getByLabelText('Test ID');
    const feedbackInput = screen.getByLabelText('Test Feedback');
    const submitButton = screen.getByText('Submit');

    fireEvent.change(idInput, { target: { value: 'test-id' } });
    fireEvent.change(feedbackInput, { target: { value: 'test-feedback' } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('test-id', 'test-feedback');
  });
});
