/**
 * WelcomeBanner — unit tests for the dismiss + persist behaviour.
 *
 * The web vitest setup replaces window.localStorage with vi.fn() mocks
 * (see use-theme.test.tsx for the same pattern), so we drive getItem +
 * setItem through vi.mocked() instead of operating on a real Storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { WelcomeBanner } from '@/presentation/web/components/onboarding/welcome-banner';

const STORAGE_KEY = 'shep:onboarding:test:v1';

describe('WelcomeBanner', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('renders when no dismissal flag is present', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    render(<WelcomeBanner id="test:v1" title="Hello" description="World" />);
    expect(await screen.findByTestId('welcome-banner-test:v1')).toBeInTheDocument();
  });

  it('does not render when localStorage already says dismissed', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('1');
    render(<WelcomeBanner id="test:v1" title="Hello" description="World" />);
    await waitFor(() =>
      expect(screen.queryByTestId('welcome-banner-test:v1')).not.toBeInTheDocument()
    );
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('dismiss button hides the banner and persists the flag', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    render(<WelcomeBanner id="test:v1" title="Hello" description="World" />);
    const dismiss = await screen.findByTestId('welcome-banner-test:v1-dismiss');
    fireEvent.click(dismiss);
    await waitFor(() =>
      expect(screen.queryByTestId('welcome-banner-test:v1')).not.toBeInTheDocument()
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, '1');
  });

  it('forceVisible bypasses localStorage', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('1');
    render(<WelcomeBanner id="test:v1" title="Hello" description="World" forceVisible={true} />);
    expect(await screen.findByTestId('welcome-banner-test:v1')).toBeInTheDocument();
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
});
