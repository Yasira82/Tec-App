/**
 * Regression guard for the canonical plan resolver.
 *
 * Two real production bugs are pinned here:
 *  1. The Dashboard read `user.subscriptionPlan` from the auth session — which is always
 *     null — so a paying ENTERPRISE user saw "Free".
 *  2. The commerce status envelope is NESTED (`data.subscription.plan`). Reading
 *     `.data.plan` (flat) silently resolves FREE and locks Pro OFF for paying users.
 *
 * These tests mock the REAL nested shape — a resolver test is only as good as the shape
 * it mocks.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlan } from '@/lib-client/hooks/useSubscriptionPlan';
import { normalizePayment, formatTxDate, isKycVerified } from '@/lib/dashboard-data';

describe('resolvePlan', () => {
  it('unwraps the NESTED commerce envelope (data.subscription.plan)', () => {
    const res = resolvePlan({
      success: true,
      data: { subscription: { plan: 'ENTERPRISE', isActive: true, isExpired: false, daysRemaining: 12 } },
    });
    expect(res.plan).toBe('ENTERPRISE');
    expect(res.isPaid).toBe(true);
    expect(res.daysRemaining).toBe(12);
  });

  it('resolves PRO as paid', () => {
    const res = resolvePlan({ data: { subscription: { plan: 'PRO', isActive: true, isExpired: false } } });
    expect(res.plan).toBe('PRO');
    expect(res.isPaid).toBe(true);
  });

  it('uppercases a lowercase plan from the API', () => {
    const res = resolvePlan({ data: { subscription: { plan: 'enterprise', isActive: true } } });
    expect(res.plan).toBe('ENTERPRISE');
    expect(res.isPaid).toBe(true);
  });

  it('treats an EXPIRED paid plan as not paid (no auto-renewal)', () => {
    const res = resolvePlan({ data: { subscription: { plan: 'PRO', isActive: true, isExpired: true } } });
    expect(res.plan).toBe('PRO');
    expect(res.isPaid).toBe(false);
    expect(res.isExpired).toBe(true);
  });

  it('treats an INACTIVE paid plan as not paid', () => {
    const res = resolvePlan({ data: { subscription: { plan: 'PRO', isActive: false } } });
    expect(res.isPaid).toBe(false);
  });

  it('FREE is never paid', () => {
    const res = resolvePlan({ data: { subscription: { plan: 'FREE', isActive: true } } });
    expect(res.plan).toBe('FREE');
    expect(res.isPaid).toBe(false);
  });

  it('falls back to a flat data envelope', () => {
    expect(resolvePlan({ data: { plan: 'PRO', isActive: true } }).plan).toBe('PRO');
  });

  it('falls back to a bare object', () => {
    expect(resolvePlan({ plan: 'PRO', isActive: true }).plan).toBe('PRO');
  });

  it('fails closed to FREE on junk / empty / null (P6)', () => {
    for (const bad of [null, undefined, {}, { data: {} }, { data: { subscription: {} } }, 'nope', 42]) {
      const res = resolvePlan(bad);
      expect(res.plan).toBe('FREE');
      expect(res.isPaid).toBe(false);
    }
  });

  it('does NOT read a plan that only exists at data.plan when the nested one is FREE', () => {
    // Guards the exact inversion: nested is authoritative, flat must not override it.
    const res = resolvePlan({ plan: 'ENTERPRISE', data: { subscription: { plan: 'FREE' } } });
    expect(res.plan).toBe('FREE');
  });
});

// ── Dashboard response parsers ───────────────────────────────────────────────

describe('isKycVerified', () => {
  it('reads the REAL nested shape data.kyc.status', () => {
    expect(isKycVerified({ success: true, data: { kyc: { status: 'VERIFIED', level: 'L1' } } })).toBe(true);
  });

  it('is false for a non-verified status', () => {
    for (const status of ['PENDING', 'NOT_STARTED', 'REJECTED']) {
      expect(isKycVerified({ data: { kyc: { status } } })).toBe(false);
    }
  });

  it('accepts a lowercase status', () => {
    expect(isKycVerified({ data: { kyc: { status: 'verified' } } })).toBe(true);
  });

  it('still honours the legacy boolean fallbacks', () => {
    expect(isKycVerified({ verified: true })).toBe(true);
    expect(isKycVerified({ data: { kycVerified: true } })).toBe(true);
  });

  it('fails closed to unverified on junk (P6)', () => {
    for (const bad of [null, undefined, {}, { data: {} }, { data: { kyc: {} } }, 'nope']) {
      expect(isKycVerified(bad)).toBe(false);
    }
  });
});

describe('normalizePayment', () => {
  it('reads snake_case created_at (the "Invalid Date" bug)', () => {
    const p = normalizePayment({ id: 'p1', amount: '12.5', status: 'COMPLETED', type: 'PAYMENT', created_at: '2026-08-20T10:00:00Z' });
    expect(p.createdAt).toBe('2026-08-20T10:00:00Z');
    expect(Number.isNaN(new Date(p.createdAt).getTime())).toBe(false);
    expect(p.amount).toBe(12.5);
    expect(p.status).toBe('completed');
    expect(p.type).toBe('payment');
  });

  it('also reads camelCase createdAt', () => {
    expect(normalizePayment({ createdAt: '2026-08-20T10:00:00Z' }).createdAt).toBe('2026-08-20T10:00:00Z');
  });

  it('defaults type to payment when absent', () => {
    expect(normalizePayment({ id: 'x' }).type).toBe('payment');
  });
});

describe('formatTxDate', () => {
  it('never returns the string "Invalid Date"', () => {
    for (const bad of ['', 'not-a-date', 'undefined']) {
      expect(formatTxDate(bad, 'en')).toBeNull();
    }
  });

  it('formats a real date', () => {
    expect(formatTxDate('2026-08-20T10:00:00Z', 'en')).toBeTruthy();
  });
});
