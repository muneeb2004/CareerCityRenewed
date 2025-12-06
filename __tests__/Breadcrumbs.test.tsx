import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Breadcrumbs from '../src/lib/components/ui/Breadcrumbs';
import { usePathname } from 'next/navigation';

// Mock usePathname
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

describe('Breadcrumbs', () => {
  beforeEach(() => {
    // Reset the mock before each test
    (usePathname as jest.Mock).mockReturnValue('/');
  });

  test('does not render on the main staff dashboard page', () => {
    (usePathname as jest.Mock).mockReturnValue('/staff');
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders a single breadcrumb for a top-level page', () => {
    (usePathname as jest.Mock).mockReturnValue('/staff/organizations');
    render(<Breadcrumbs />);
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Organizations').closest('a')).not.toBeInTheDocument(); // Last item should not be a link
  });

  test('renders multiple breadcrumbs for nested pages', () => {
    (usePathname as jest.Mock).mockReturnValue('/staff/organizations/details');
    render(<Breadcrumbs />);
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Organizations').closest('a')).toHaveAttribute('href', '/staff/organizations');
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Details').closest('a')).not.toBeInTheDocument(); // Last item should not be a link
  });

  test('formats segment text correctly (hyphens to spaces, capitalize)', () => {
    (usePathname as jest.Mock).mockReturnValue('/staff/student-records');
    render(<Breadcrumbs />);
    expect(screen.getByText('Student Records')).toBeInTheDocument();
  });
});
