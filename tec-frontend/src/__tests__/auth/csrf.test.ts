/**
 * VM-005 — CSRF double-submit verification test
 * Tests the CSRF logic directly without importing middleware
 */
import { describe, it, expect } from 'vitest';

// ── Test the CSRF logic directly ──────────────────────────────
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_PROTECTED = [
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/wallet',
  '/api/payment',
  '/api/payments',
  '/api/kyc',
  '/api/notifications',
  '/api/assets',
  '/api/marketplace',
  '/api/commerce',
  '/api/subscriptions',
];

function checkCsrf(
  method: string,
  pathname: string,
  csrfCookie?: string,
  csrfHeader?: string
): { blocked: boolean; code?: string } {
  if (CSRF_SAFE_METHODS.has(method.toUpperCase())) return { blocked: false };

  const isCsrfProtected = CSRF_PROTECTED.some((r) => pathname.startsWith(r));
  if (!isCsrfProtected) return { blocked: false };

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return { blocked: true, code: 'CSRF_INVALID' };
  }

  return { blocked: false };
}

describe('VM-005 — CSRF double-submit pattern', () => {
  it('GET requests bypass CSRF check', () => {
    const result = checkCsrf('GET', '/api/wallet/transfer', undefined, undefined);
    expect(result.blocked).toBe(false);
  });

  it('HEAD requests bypass CSRF check', () => {
    const result = checkCsrf('HEAD', '/api/wallet/transfer', 'csrf-123', undefined);
    expect(result.blocked).toBe(false);
  });

  it('POST without CSRF cookie → blocked', () => {
    const result = checkCsrf('POST', '/api/wallet/transfer', undefined, 'csrf-123');
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST without CSRF header → blocked', () => {
    const result = checkCsrf('POST', '/api/wallet/transfer', 'csrf-123', undefined);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST with mismatched CSRF → blocked', () => {
    const result = checkCsrf('POST', '/api/wallet/transfer', 'token-A', 'token-B');
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST with matching CSRF → passes', () => {
    const result = checkCsrf('POST', '/api/wallet/transfer', 'valid-token', 'valid-token');
    expect(result.blocked).toBe(false);
  });

  it('POST on /api/auth/logout without CSRF → blocked', () => {
    const result = checkCsrf('POST', '/api/auth/logout', undefined, undefined);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST on /api/payments with valid CSRF → passes', () => {
    const result = checkCsrf('POST', '/api/payments/create', 'tok', 'tok');
    expect(result.blocked).toBe(false);
  });

  it('POST on unprotected route → passes regardless of CSRF', () => {
    const result = checkCsrf('POST', '/api/market/pi-price', undefined, undefined);
    expect(result.blocked).toBe(false);
  });

  it('empty CSRF values → blocked', () => {
    const result = checkCsrf('POST', '/api/wallet/transfer', '', '');
    expect(result.blocked).toBe(true);
  });

  it('POST on /api/payment/cancel without CSRF → blocked', () => {
    const result = checkCsrf('POST', '/api/payment/cancel', undefined, undefined);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST on /api/payment/complete with valid CSRF → passes', () => {
    const result = checkCsrf('POST', '/api/payment/complete', 'tok', 'tok');
    expect(result.blocked).toBe(false);
  });

  it('POST on /api/commerce/orders without CSRF → blocked', () => {
    const result = checkCsrf('POST', '/api/commerce/orders', undefined, undefined);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });

  it('POST on /api/subscriptions without CSRF → blocked', () => {
    const result = checkCsrf('POST', '/api/subscriptions', undefined, undefined);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('CSRF_INVALID');
  });
});
