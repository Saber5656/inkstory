import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/setup';
import { Onboarding } from './Onboarding';

describe('Onboarding', () => {
  it('shows three localized, skippable first-run cards', async () => {
    await i18n.changeLanguage('ja');
    const dismiss = vi.fn();
    const watchSample = vi.fn();
    const { unmount } = render(
      <MemoryRouter>
        <Onboarding
          sampleBookId="sample-book"
          onDismiss={dismiss}
          onWatchSample={watchSample}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'サンプルをみる' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'じぶんのおはなしをつくる' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'きみの声を入れてみよう' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '絵からつくる' })).toHaveAttribute(
      'href',
      '/characters/new',
    );

    fireEvent.click(screen.getByRole('button', { name: 'サンプルであそぶ' }));
    fireEvent.click(screen.getByRole('button', { name: 'とじる' }));
    expect(watchSample).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();

    unmount();
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <Onboarding
          sampleBookId="sample-book"
          onDismiss={vi.fn()}
          onWatchSample={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Watch the sample book' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Make your own' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Tell it in your voice' }),
    ).toBeInTheDocument();
  });
});
