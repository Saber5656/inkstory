import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Shell } from './Shell';
import i18n from '@/i18n/setup';

describe('localized shell', () => {
  it('changes language and html lang immediately and persists', async () => {
    await i18n.changeLanguage('ja');
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Shell />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText('ことば'), {
      target: { value: 'en' },
    });
    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('inkstory.locale')).toBe('en');
  });
});
