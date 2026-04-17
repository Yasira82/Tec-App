/**
 * VM-005 — CSRF double-submit verification test
 * Verifies middleware blocks requests without valid CSRF token
 */
import { vi, describe, it, expect } from 'vitest';

// ── Mock middleware dependencies ──────────────────────────────
const mockRedirect = vi.fn();
const mockNext     = vi.fn();
const mockJson     = vi.fn();

vi.mock('next/server', () => ({
  NextRequest:  class MockNextRequest {
    method:   string;
    nextUrl:  { pathname: string };
    cookies:  { get: (name: string) => { value: string } | undefined };
    headers:  { get: (name: string) => string | null };
    url:      string;

    constructor(url: string, init?: { method?: string }) {
      this.url     = url;
      this.method  = init?.method ?? 'GET';
      this.nextUrl = { pathname: new URL(url).pathname };
      this.cookies = { get: () => undefined };
      this.headers = { get: () => null };
    }
  },
  NextResponse: {
    next:     () => ({ type: 'next' }),
    redirect: (url: URL) => { mockRedirect(url.toString()); return { type: 'redirect' }; },
    json:     (body: unknown, init?: { status?: number }) => {
      mockJson(body, init);
      return { type: 'json', body, status: init?.status };
    },
  },
}));

// ── Import middleware after mock ──────────────────────────────
const buildRequest = (
  pathname: string,
  method:   string,
  csrfCookie?: string,
  csrfHeader?: string,
  accessToken?: string,
) => {
  const { NextRequest } = require('next/server');
  const req = new NextRequest(`http://localhost${pathname}`, { method });

  req.cookies = {
    get: (name: string) => {
      if (name === 'tec_csrf')         return csrfCookie ? { value: csrfCookie } : undefined;
      if (name === 'tec_access_token') return accessToken ? { value: accessToken } : undefined;
      return undefined;
    },
  };

  req.headers = {
    get: (name: string) => {
      if (name === 'x-csrf-token') return csrfHeader ?? null;
      return null;
    },
  };

  return req;
};

describe('VM-005 — CSRF double-submit pattern', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('GET requests bypass CSRF check', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'GET', 'csrf-token-123', undefined, 'access-token');
    const res = await middleware(req);
    expect(res.type).toBe('next');
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('POST without CSRF cookie → 403', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', undefined, 'csrf-token-123', 'access-token');
    const res = await middleware(req);
    expect(res.status).toBe(403);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
      expect.objectContaining({ status: 403 }),
    );
  });

  it('POST without CSRF header → 403', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'csrf-token-123', undefined, 'access-token');
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it('POST with mismatched CSRF → 403', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'token-A', 'token-B', 'access-token');
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it('POST with matching CSRF → passes', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'valid-csrf-token', 'valid-csrf-token', 'access-token');
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('CSRF check on /api/auth/logout', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/auth/logout', 'POST', undefined, undefined, 'access-token');
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it('CSRF check on /api/payments', async () => {
    const { middleware } = await import('@/../../middleware');
    const req = buildRequest('/api/payments/create', 'POST', 'token-X', 'token-X', 'access-token');
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });
});
