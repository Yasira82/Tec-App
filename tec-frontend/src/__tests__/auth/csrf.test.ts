/**
 * VM-005 — CSRF double-submit verification test
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockJson = vi.fn((body: unknown, init?: { status?: number }) => ({
  type: 'json', body, status: init?.status ?? 200,
}));

vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    method:   string;
    nextUrl:  { pathname: string };
    url:      string;
    _cookies: Record<string, string>;
    _headers: Record<string, string>;

    constructor(url: string, init?: { method?: string }) {
      this.url      = url;
      this.method   = init?.method ?? 'GET';
      this.nextUrl  = { pathname: new URL(url).pathname };
      this._cookies = {};
      this._headers = {};
    }

    get cookies() {
      const c = this._cookies;
      return { get: (name: string) => c[name] ? { value: c[name] } : undefined };
    }

    get headers() {
      const h = this._headers;
      return { get: (name: string) => h[name] ?? null };
    }
  },
  NextResponse: {
    next: () => ({ type: 'next', status: 200 }),
    redirect: (url: URL) => ({ type: 'redirect', url: url.toString() }),
    json: mockJson,
  },
}));

const buildRequest = (
  pathname:     string,
  method:       string,
  csrfCookie?:  string,
  csrfHeader?:  string,
  accessToken?: string,
) => {
  const { NextRequest } = require('next/server');
  const req = new NextRequest(`http://localhost${pathname}`, { method });

  if (csrfCookie)  req._cookies['tec_csrf']         = csrfCookie;
  if (accessToken) req._cookies['tec_access_token']  = accessToken;
  if (csrfHeader)  req._headers['x-csrf-token']      = csrfHeader;

  return req;
};

describe('VM-005 — CSRF double-submit pattern', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('GET requests bypass CSRF check', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'GET', 'csrf-123', undefined, 'token');
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('POST without CSRF cookie → 403', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', undefined, 'csrf-123', 'token');
    await middleware(req);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
      expect.objectContaining({ status: 403 }),
    );
  });

  it('POST without CSRF header → 403', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'csrf-123', undefined, 'token');
    await middleware(req);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
      expect.objectContaining({ status: 403 }),
    );
  });

  it('POST with mismatched CSRF → 403', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'token-A', 'token-B', 'token');
    await middleware(req);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
      expect.objectContaining({ status: 403 }),
    );
  });

  it('POST with matching CSRF → passes', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/wallet/transfer', 'POST', 'valid-token', 'valid-token', 'token');
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('CSRF check on /api/auth/logout', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/auth/logout', 'POST', undefined, undefined, 'token');
    await middleware(req);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
      expect.objectContaining({ status: 403 }),
    );
  });

  it('POST with valid CSRF on /api/payments → passes', async () => {
    const { middleware } = await import('../../../middleware');
    const req = buildRequest('/api/payments/create', 'POST', 'tok', 'tok', 'token');
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });
});
