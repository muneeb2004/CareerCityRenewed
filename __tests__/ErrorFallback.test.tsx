import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorFallback } from '../src/lib/components/ui/ErrorFallback';
import { FallbackProps } from 'react-error-boundary';

describe('ErrorFallback', () => {
  const mockError: Error = new Error('Test Error Message');
  const mockReset = jest.fn();
  const defaultProps: FallbackProps = {
    error: mockError,
    resetErrorBoundary: mockReset,
  };

  test('renders error message and title', () => {
    render(<ErrorFallback {...defaultProps} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test Error Message')).toBeInTheDocument();
  });

  test('calls resetErrorBoundary when "Try again" button is clicked', () => {
    render(<ErrorFallback {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
