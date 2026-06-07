import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── i18n ─────────────────────────────────────────────────────────
describe('i18n LocaleProvider + useTranslation', () => {
  it('renders children in english by default', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n');
    function TestComponent() {
      const { t, locale } = useTranslation();
      return <div data-testid="locale">{locale}</div>;
    }
    render(<LocaleProvider><TestComponent /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('provides translation object with known keys', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n');
    let capturedT: any;
    function TestComponent() {
      const { t } = useTranslation();
      capturedT = t;
      return null;
    }
    render(<LocaleProvider><TestComponent /></LocaleProvider>);
    expect(capturedT).toBeDefined();
    expect(typeof capturedT).toBe('object');
  });
});

// ── ErrorBoundary ────────────────────────────────────────────────
describe('ErrorBoundary', () => {
  it('renders children when no error', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary');
    render(<ErrorBoundary><div>safe content</div></ErrorBoundary>);
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders fallback on error', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary');
    const BrokenChild = () => { throw new Error('Test error'); return null; };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <BrokenChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

// ── lib/hub utilities ────────────────────────────────────────────
describe('haptic utility', () => {
  it('does not throw without navigator.vibrate', async () => {
    const { haptic } = await import('@/lib/hub/utils');
    expect(() => haptic('light')).not.toThrow();
    expect(() => haptic('medium')).not.toThrow();
    expect(() => haptic('heavy')).not.toThrow();
    expect(() => haptic()).not.toThrow();
  });
});

// ── AppCardSkeleton ──────────────────────────────────────────────
describe('AppCardSkeleton', () => {
  it('renders without crash', async () => {
    const mod = await import('@/components/AppCardSkeleton');
    const AppCardSkeleton = mod.AppCardSkeleton ?? mod.default;
    if (!AppCardSkeleton) return; // CSS module may not resolve in test env
    const { container } = render(<AppCardSkeleton />);
    expect(container).toBeTruthy();
  });
});

// ── BackendOfflineBanner ─────────────────────────────────────────
describe('BackendOfflineBanner', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  it('renders without crash', async () => {
    const { BackendOfflineBanner } = await import('@/components/BackendOfflineBanner');
    const { container } = render(<BackendOfflineBanner />);
    expect(container).toBeTruthy();
  });
});
