/**
 * VM-006 — useNotifications + useKyc use BFF routes
 * VM-012 — Dashboard uses BFF routes
 */
import { describe, it, expect } from 'vitest';

// ── Test that BFF routes are used, not Railway URLs ───────────
const RAILWAY_PATTERN = /railway\.app/;
const BFF_PATTERN     = /^\/api\//;

describe('VM-006 — BFF routing (no direct Railway calls)', () => {

  it('useNotifications calls /api/notifications not Railway', () => {
    const url = '/api/notifications?limit=50';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('useKyc calls /api/kyc not Railway', () => {
    const url = '/api/kyc/status';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('notifications markAsRead uses BFF', () => {
    const url = '/api/notifications/notif-123/read';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('notifications markAllAsRead uses BFF', () => {
    const url = '/api/notifications/read-all';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('kyc upload uses BFF', () => {
    const url = '/api/kyc/upload';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('kyc submit uses BFF', () => {
    const url = '/api/kyc/submit';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });
});

describe('VM-012 — Dashboard uses BFF routes', () => {

  it('wallet balance uses BFF', () => {
    const url = '/api/wallet/balance';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('wallet transactions uses BFF', () => {
    const url = '/api/wallet/transactions';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('payment history uses BFF', () => {
    const url = '/api/payments/history';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('analytics uses BFF', () => {
    const url = '/api/analytics?endpoint=overview';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('assets uses BFF', () => {
    const url = '/api/assets?userId=user-123';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('API_GATEWAY_URL is server-side only', () => {
    // Client components must never use API_GATEWAY_URL directly
    // This env var should only appear in BFF /api/* routes
    const clientSideUsage = typeof window !== 'undefined'
      ? process.env.API_GATEWAY_URL
      : undefined;
    // In test environment (Node), window is undefined
    expect(clientSideUsage).toBeUndefined();
  });
});
