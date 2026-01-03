import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PullToRefresh } from '../src/lib/components/ui/PullToRefresh';

// Mock IntersectionObserver for react-window
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
(global as any).IntersectionObserver = MockIntersectionObserver;


describe('PullToRefresh', () => {
  const mockOnRefresh = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    mockOnRefresh.mockClear();
    // Reset any global state from previous tests if needed
  });

  test('renders children correctly', () => {
    render(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div>Scrollable Content</div>
      </PullToRefresh>
    );
    expect(screen.getByText('Scrollable Content')).toBeInTheDocument();
  });

  test('does not refresh if not pulled down enough', async () => {
    render(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div style={{ height: '200px', overflowY: 'auto' }}>Content</div>
      </PullToRefresh>
    );
    const container = screen.getByText('Content').closest('div') as HTMLElement;

    fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(container, { touches: [{ clientY: 150 }] }); // Pull only 50px
    fireEvent.touchEnd(container);

    await waitFor(() => {
      expect(mockOnRefresh).not.toHaveBeenCalled();
    });
  });

  test('calls onRefresh when pulled down beyond threshold', async () => {
    render(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div style={{ height: '200px', overflowY: 'auto' }}>Content</div>
      </PullToRefresh>
    );
    const container = screen.getByText('Content').closest('div') as HTMLElement;

    fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(container, { touches: [{ clientY: 200 }] }); // Pull 100px (more than threshold 80)
    fireEvent.touchEnd(container);

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test('shows loading indicator during refresh', async () => {
    let resolveRefresh: (value?: unknown) => void;
    const longRunningRefresh = jest.fn(() => new Promise(resolve => { resolveRefresh = resolve; }));
    
    const { container: rootContainer } = render(
      <PullToRefresh onRefresh={longRunningRefresh}>
        <div style={{ height: '200px', overflowY: 'auto' }}>Content</div>
      </PullToRefresh>
    );
    const contentElement = screen.getByText('Content').closest('div') as HTMLElement;

    fireEvent.touchStart(contentElement, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(contentElement, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(contentElement);

    await waitFor(() => {
      expect(longRunningRefresh).toHaveBeenCalledTimes(1);
      // The spinner uses a div with animate-spin class, search in the root container
      expect(rootContainer.querySelector('.animate-spin')).toBeInTheDocument();
    });

    // Resolve the promise to end refreshing
    (resolveRefresh!());
    await waitFor(() => {
      expect(rootContainer.querySelector('.animate-spin')).not.toBeInTheDocument();
    });
  });
});
