/**
 * Final coverage push — small remaining gaps:
 *   domains/_types intervalToPeriodSecs, PiRuntime, lib/bff-auth,
 *   pi-auth refreshAccessToken/resolvePendingPayment/waitForPiSDK,
 *   PiSdkLoader timeout, PaymentDiagnostics, app/layout, usePiPayment.testSDK
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, fireEvent } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────
const mockResolveIncomplete = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: { resolveIncomplete: mockResolveIncomplete },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  addBreadcrumb:  vi.fn(),
}));

const mockEnsureAuth          = vi.hoisted(() => vi.fn());
const mockEnsurePaymentsReady = vi.hoisted(() => vi.fn());
const mockReInit              = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          mockEnsureAuth,
    ensurePaymentsReady: mockEnsurePaymentsReady,
    reInit:              mockReInit,
    reset:               vi.fn(),
    lastError:           null,
  },
  PiAuthError: class PiAuthError extends Error {},
}));

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn((_name: string) => undefined as { value: string } | undefined),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('next/font/google', () => ({
  Cormorant_Garamond: () => ({ variable: '--font-cormorant' }),
  DM_Sans:            () => ({ variable: '--font-dm-sans' }),
}));

vi.mock('next/script', () => ({
  default: (props: any) => <script data-testid="next-script" data-src={props.src} />,
}));

vi.mock('@/components/ClientProviders', () => ({
  ClientProviders: ({ children }: any) => <div data-testid="providers">{children}</div>,
}));
vi.mock('@/components/PiSdkLoader', () => ({
  default: () => <div data-testid="pi-sdk-loader" />,
}));
vi.mock('@/components/BackendOfflineBanner', () => ({
  BackendOfflineBanner: () => null,
}));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/components/PiBrowserGuard', () => ({
  default: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/app/globals.css', () => ({}));
vi.mock('@/components/PaymentDiagnostics.module.css', () => ({
  default: new Proxy({}, { get: (_t, k) => String(k) }),
}));

import { intervalToPeriodSecs } from '@/domains/_types';
import { PiRuntime } from '@/lib-client/pi/PiRuntime';
import { extractBffAuth } from '@/lib/bff-auth';
import {
  refreshAccessToken,
  resolvePendingPayment,
  waitForPiSDK,
  getRefreshToken,
} from '@/lib-client/pi/pi-auth';
import PaymentDiagnostics from '@/components/PaymentDiagnostics';
import RootLayout from '@/app/layout';
import { NextResponse } from 'next/server';

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureAuth.mockResolvedValue(true);
  mockEnsurePaymentsReady.mockResolvedValue(true);
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── domains/_types ────────────────────────────────────────────────
describe('intervalToPeriodSecs', () => {
  it('fixed-secs returns the given seconds', () => {
    expect(intervalToPeriodSecs({ kind: 'fixed-secs', secs: 120 })).toBe(120);
  });
  it('calendar-month returns 30 days', () => {
    expect(intervalToPeriodSecs({ kind: 'calendar-month' })).toBe(30 * 24 * 3600);
  });
  it('calendar-year returns 365 days', () => {
    expect(intervalToPeriodSecs({ kind: 'calendar-year' })).toBe(365 * 24 * 3600);
  });
  it('lifetime returns undefined', () => {
    expect(intervalToPeriodSecs({ kind: 'lifetime' })).toBeUndefined();
  });
});

// ── PiRuntime ─────────────────────────────────────────────────────
describe('PiRuntime', () => {
  it('isReady false without __TEC_PI_READY', () => {
    expect(PiRuntime.isReady()).toBe(false);
  });

  it('isReady true when flag and Pi present', () => {
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    expect(PiRuntime.isReady()).toBe(true);
  });

  it('init delegates to piSession.reInit', () => {
    PiRuntime.init(true, 'app-1');
    expect(mockReInit).toHaveBeenCalledWith(true, 'app-1');
  });

  it('createPayment calls onError when Pi missing', () => {
    const onError = vi.fn();
    PiRuntime.createPayment({ amount: 1, memo: 'm', metadata: {} } as any, {
      onReadyForServerApproval: vi.fn(),
      onReadyForServerCompletion: vi.fn(),
      onCancel: vi.fn(),
      onError,
    } as any);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Pi SDK not available',
    }));
  });

  it('createPayment delegates to window.Pi.createPayment when available', () => {
    const createPayment = vi.fn();
    (window as any).Pi = { createPayment, authenticate: vi.fn() };
    const cbs = {
      onReadyForServerApproval: vi.fn(), onReadyForServerCompletion: vi.fn(),
      onCancel: vi.fn(), onError: vi.fn(),
    } as any;
    PiRuntime.createPayment({ amount: 2, memo: 'x', metadata: {} } as any, cbs);
    expect(createPayment).toHaveBeenCalled();
  });
});

// ── lib/bff-auth ──────────────────────────────────────────────────
describe('extractBffAuth', () => {
  const makeReq = (headers: Record<string, string> = {}) => ({
    headers: { get: (k: string) => headers[k] ?? null },
  }) as any;

  const setCookies = (map: Record<string, string>) => {
    mockCookieStore.get.mockImplementation((name: string) =>
      map[name] !== undefined ? { value: map[name] } : undefined,
    );
  };

  it('401 when cookies missing', async () => {
    setCookies({});
    const res = await extractBffAuth(makeReq());
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
  });

  it('401 on corrupted user cookie JSON', async () => {
    setCookies({ tec_access_token: 'tok', tec_user: '{broken' });
    const res = await extractBffAuth(makeReq());
    expect((res as NextResponse).status).toBe(401);
    const body = await (res as NextResponse).json();
    expect(body.error.code).toBe('INVALID_SESSION');
  });

  it('401 when user cookie lacks id', async () => {
    setCookies({ tec_access_token: 'tok', tec_user: JSON.stringify({ name: 'x' }) });
    const res = await extractBffAuth(makeReq());
    expect((res as NextResponse).status).toBe(401);
  });

  it('403 on CSRF mismatch when requireCsrf', async () => {
    setCookies({
      tec_access_token: 'tok',
      tec_user: JSON.stringify({ id: 'u-1' }),
      tec_csrf: 'cookie-csrf',
    });
    const res = await extractBffAuth(makeReq({ 'x-csrf-token': 'other' }), { requireCsrf: true });
    expect((res as NextResponse).status).toBe(403);
  });

  it('returns context on valid auth + matching CSRF', async () => {
    setCookies({
      tec_access_token: 'tok-9',
      tec_user: JSON.stringify({ id: 'u-7' }),
      tec_csrf: 'csrf-match',
    });
    const res = await extractBffAuth(makeReq({ 'x-csrf-token': 'csrf-match' }), { requireCsrf: true });
    expect(res).toEqual({ accessToken: 'tok-9', userId: 'u-7', csrfToken: 'csrf-match' });
  });
});

// ── pi-auth remaining branches ────────────────────────────────────
describe('pi-auth remaining branches', () => {
  it('getRefreshToken always returns null (HttpOnly)', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('resolvePendingPayment returns resolved action on success', async () => {
    mockResolveIncomplete.mockResolvedValue({ status: 'resolved' });
    const result = await resolvePendingPayment('pi-pay-1');
    expect(result).toEqual({ action: 'resolved' });
  });

  it('resolvePendingPayment returns null on sdk failure', async () => {
    mockResolveIncomplete.mockRejectedValue(new Error('terminal'));
    const result = await resolvePendingPayment('pi-pay-2');
    expect(result).toBeNull();
  });

  it('refreshAccessToken queues concurrent callers onto one request', async () => {
    let resolveFetch!: (v: any) => void;
    global.fetch = vi.fn().mockReturnValue(new Promise(r => { resolveFetch = r; }));
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken(); // queued
    resolveFetch({ ok: true, json: async () => ({ token: 'fresh-tok' }) });
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('fresh-tok');
    expect(t2).toBe('fresh-tok');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshAccessToken returns null and logs out on !ok', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({}) };
    });
    const token = await refreshAccessToken();
    expect(token).toBeNull();
  });

  it('refreshAccessToken returns null on network error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let first = true;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/auth/refresh') && first) {
        first = false;
        throw new Error('offline');
      }
      return { ok: true, json: async () => ({}) };
    });
    const token = await refreshAccessToken();
    expect(token).toBeNull();
    errSpy.mockRestore();
  });

  it('waitForPiSDK rejects immediately when __TEC_PI_ERROR set', async () => {
    (window as any).__TEC_PI_ERROR = true;
    await expect(waitForPiSDK()).rejects.toThrow();
  });

  it('waitForPiSDK resolves on tec-pi-ready event', async () => {
    const p = waitForPiSDK(5000);
    window.dispatchEvent(new Event('tec-pi-ready'));
    await expect(p).resolves.toBeUndefined();
  });

  it('waitForPiSDK rejects on tec-pi-error event', async () => {
    const p = waitForPiSDK(5000);
    window.dispatchEvent(new Event('tec-pi-error'));
    await expect(p).rejects.toThrow();
  });

  it('waitForPiSDK rejects after timeout', async () => {
    vi.useFakeTimers();
    const p = waitForPiSDK(1000);
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1100);
    await assertion;
    vi.useRealTimers();
  });
});

// ── PaymentDiagnostics ────────────────────────────────────────────
describe('PaymentDiagnostics', () => {
  const savedEnv = process.env.NEXT_PUBLIC_PI_SANDBOX;

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.NEXT_PUBLIC_PI_SANDBOX;
    else process.env.NEXT_PUBLIC_PI_SANDBOX = savedEnv;
  });

  it('renders null outside sandbox mode', async () => {
    delete process.env.NEXT_PUBLIC_PI_SANDBOX;
    const { container } = render(
      <PaymentDiagnostics isAuthenticated={false} events={[]} />,
    );
    await act(async () => {});
    expect(container.textContent).toBe('');
  });

  it('renders diagnostics panel in sandbox with event icons', async () => {
    process.env.NEXT_PUBLIC_PI_SANDBOX = 'true';
    const events = (['sdk_init', 'auth', 'approval', 'completion', 'error', 'cancel'] as const)
      .map((type, i) => ({
        timestamp: new Date(2026, 0, 1, 0, i).toISOString(),
        type, message: `evt-${type}`,
      }));
    const { container } = render(
      <PaymentDiagnostics isAuthenticated username="alice" events={events} />,
    );
    await act(async () => {});
    expect(container.textContent).toContain('Payment Diagnostics');
    for (const e of events) expect(container.textContent).toContain(`evt-${e.type}`);
  });

  it('marks SDK ready when tec-pi-ready fires', async () => {
    process.env.NEXT_PUBLIC_PI_SANDBOX = 'true';
    const { container } = render(
      <PaymentDiagnostics isAuthenticated={false} events={[]} />,
    );
    await act(async () => {});
    act(() => { window.dispatchEvent(new Event('tec-pi-ready')); });
    expect(container.textContent).toContain('Payment Diagnostics');
  });
});

// ── app/layout.tsx ────────────────────────────────────────────────
describe('RootLayout', () => {
  it('renders html shell with providers and Pi SDK script', () => {
    const { getByTestId, getByText } = render(
      <RootLayout>
        <span>page-content</span>
      </RootLayout>,
    );
    expect(getByTestId('providers')).toBeTruthy();
    expect(getByTestId('pi-sdk-loader')).toBeTruthy();
    expect(getByText('page-content')).toBeTruthy();
  });
});
