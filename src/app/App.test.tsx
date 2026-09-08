import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the inkstory application name', () => {
    window.history.replaceState({}, '', '/settings');
    render(<App />);

    expect(
      screen.getByRole('link', { name: /アトリエへ|Back to the atelier/ }),
    ).toBeInTheDocument();
  });
});
