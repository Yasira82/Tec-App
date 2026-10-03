/**
 * Only a live ACTIVE subscription grants its plan. Commerce keeps `plan: PRO` after a
 * cancel or an expiry, and the Hub's subscription page showed "Pro · Expires in 30
 * days" — with no Cancel button — after the owner had cancelled (2026-10-03).
 */
import { describe, it, expect } from 'vitest';
import { effectivePlan } from '@/lib/subscription/entitlements';

describe('effectivePlan', () => {
  it('a live ACTIVE plan is that plan', () => {
    expect(effectivePlan({ plan: 'PRO', status: 'ACTIVE', isActive: true })).toBe('PRO');
    expect(effectivePlan({ plan: 'enterprise', status: 'ACTIVE' })).toBe('ENTERPRISE');
  });
  it('a cancelled PRO is FREE', () => {
    expect(effectivePlan({ plan: 'PRO', status: 'CANCELLED', isActive: false })).toBe('FREE');
  });
  it('an expired PRO is FREE — by status, by isExpired, or by isActive:false', () => {
    expect(effectivePlan({ plan: 'PRO', status: 'EXPIRED' })).toBe('FREE');
    expect(effectivePlan({ plan: 'PRO', status: 'ACTIVE', isExpired: true })).toBe('FREE');
    expect(effectivePlan({ plan: 'PRO', status: 'ACTIVE', isActive: false })).toBe('FREE');
  });
  it('nothing, or an unknown plan, is FREE', () => {
    expect(effectivePlan(null)).toBe('FREE');
    expect(effectivePlan({ plan: 'GOLD', status: 'ACTIVE' })).toBe('FREE');
  });
});
