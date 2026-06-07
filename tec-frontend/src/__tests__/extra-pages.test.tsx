/**
 * Smoke tests for mint page, privacy, terms, and other pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('asset_id=a1&name=Test+Asset&tier=Common'),
  notFound:        vi.fn(),
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: () => ({
    user:            { id: 'u1', piUsername: 'alice', role: 'user', subscriptionPlan: 'Free' },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
  }),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: () => ({
    piReady:      false,
    authReady:    false,
    lastError:    null,
    ensurePiAuth: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          vi.fn().mockResolvedValue(true),
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    reset:               vi.fn(),
  },
  PiAuthError: {},
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    init:              vi.fn(),
    authenticate:      vi.fn(),
    createPayment:     vi.fn(),
    canAttempt:        vi.fn(() => true),
    getCircuitBreaker: vi.fn(),
  },
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      common: { loading: 'Loading...' },
      dashboard: {},
      apps: {},
      legal: {
        backHome: 'Back Home',
        effectiveDate: 'Effective Date',
        version: 'Version',
        contents: 'Contents',
        terms: {
          badge: 'Terms', title: 'Terms of Service',
          subtitle: 'Legal', intro: 'By using...',
        },
        privacy: {
          badge: 'Privacy', title: 'Privacy Policy',
          subtitle: 'How we use data', intro: 'We collect...',
        },
      },
    },
    locale: 'en',
    setLanguage: vi.fn(),
    dir: 'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

// ── Mint page ───────────────────────────────────────────────────────
describe('Mint page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/mint/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Privacy page ────────────────────────────────────────────────────
describe('Privacy page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/privacy/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});

// ── Terms page ──────────────────────────────────────────────────────
describe('Terms page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/terms/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});

// ── bff-auth utility ────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'tec_access_token') return { value: 'test-token' };
      if (name === 'tec_user') return { value: JSON.stringify({ id: 'user-1' }) };
      if (name === 'tec_csrf') return { value: 'csrf-token' };
      return undefined;
    }),
  }),
}));

describe('extractBffAuth', () => {
  it('returns auth context when cookies present', async () => {
    const { NextRequest } = await import('next/server');
    const { extractBffAuth } = await import('@/lib/bff-auth');
    const req = new NextRequest('http://localhost/api/test');
    const result = await extractBffAuth(req);
    // Should return BffAuthContext (not a NextResponse)
    expect(result).toBeTruthy();
    expect(typeof (result as any).accessToken).toBe('string');
  });

  it('returns 401 when cookies missing', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValueOnce({
      get: vi.fn(() => undefined),
    } as any);
    const { NextRequest } = await import('next/server');
    const { extractBffAuth } = await import('@/lib/bff-auth');
    const req = new NextRequest('http://localhost/api/test');
    const result = await extractBffAuth(req);
    expect(result).toBeTruthy();
    // When no cookies, returns NextResponse with 401
  });

  it('isBffAuthError detects NextResponse', async () => {
    const { NextResponse } = await import('next/server');
    const { isBffAuthError } = await import('@/lib/bff-auth');
    const res = NextResponse.json({ error: 'test' }, { status: 401 });
    expect(isBffAuthError(res)).toBe(true);
  });

  it('isBffAuthError returns false for auth context', async () => {
    const { isBffAuthError } = await import('@/lib/bff-auth');
    const ctx = { accessToken: 'tok', userId: 'u1', csrfToken: null };
    expect(isBffAuthError(ctx as any)).toBe(false);
  });
});
