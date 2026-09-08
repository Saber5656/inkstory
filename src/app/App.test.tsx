import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the inkstory application name', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'inkstory' }),
    ).toBeInTheDocument();
  });
});
