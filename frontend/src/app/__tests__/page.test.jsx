import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../page';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';

describe('Home Component', () => {
  it('renders the header title correctly', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1, name: /Never miss a medication again/i });
    expect(heading).toBeInTheDocument();
  });
});

describe('EmptyState Component', () => {
  it('renders custom title and description', () => {
    render(
      <EmptyState
        title="No items found"
        description="Please add your first item to get started."
        actionLabel="Add Item"
      />
    );
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Please add your first item to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeInTheDocument();
  });
});

describe('ErrorMessage Component', () => {
  it('renders error title and message correctly', () => {
    render(
      <ErrorMessage
        title="Failed to fetch data"
        message="Network timeout occurred."
      />
    );
    expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    expect(screen.getByText('Network timeout occurred.')).toBeInTheDocument();
  });
});
