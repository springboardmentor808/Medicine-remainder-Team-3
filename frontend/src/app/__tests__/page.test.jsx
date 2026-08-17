import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../page';

describe('Home Component', () => {
  it('renders the header title correctly', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1, name: /Never miss a medication again/i });
    expect(heading).toBeInTheDocument();
  });
});
