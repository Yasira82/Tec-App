/**
 * The assistant reads the budget Life's door already serves — when BUDGET is granted.
 *
 * Life owns the monthly caps a person sets per app (C-106 §10 Phase 1, L1) and its
 * consent door serves them as `budget: { period, caps: [{ category, cap_pi }] }` —
 * only when BUDGET is granted, this month only. `life-context.ts` dropped them, so
 * the assistant could not help anyone stay inside a plan they had written down.
 *
 * Narrowed like every other category: absent from the payload = not served; a cap
 * is a positive decimal string with at most 8 places (DECIMAL(20,8), C-47), a
 * category an app slug — anything else is dropped, never coerced. The caps are a
 * person's LIMITS, not their spending: payment-service owns what was spent, and
 * the prompt says the assistant does not know it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lifeContextToAi, budgetPromptLine } from '@/lib/ai/life-context';
import { signContext, verifyContext } from '@/lib/ai/context-token';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const SECRET = 'a-32-character-secret-for-tests!!';

const served = (context: Record<string, unknown>, consent: Record<string, boolean> = {}) => ({
  data: { consent: Object.entries(consent).map(([category, granted]) => ({ category, granted })), context },
});

describe('lifeContextToAi — budget', () => {
  it('BUDGET granted → the month and its caps, as Life wrote them (strings, never floats)', () => {
    const r = lifeContextToAi(served({ budget: { period: '2026-10', caps: [
      { category: 'ecommerce', cap_pi: '50' },
      { category: 'commerce',  cap_pi: '12.5', updated_at: '2026-10-01T00:00:00Z' },
    ] } }, { BUDGET: true }));
    expect(r.budget).toEqual({ period: '2026-10', caps: [
      { category: 'ecommerce', cap_pi: '50' },
      { category: 'commerce',  cap_pi: '12.5' },
    ] });
    expect(JSON.stringify(r)).not.toContain('updated_at');
  });

  it('a cap that is not a positive decimal (≤ 8 places), or a category that is not a slug, is dropped — never coerced', () => {
    const r = lifeContextToAi(served({ budget: { period: '2026-10', caps: [
      { category: 'ok',        cap_pi: '1.00000001' },
      { category: 'zero',      cap_pi: '0' },
      { category: 'neg',       cap_pi: '-5' },
      { category: 'float',     cap_pi: 5 },
      { category: 'nine',      cap_pi: '1.123456789' },
      { category: 'Bad Slug',  cap_pi: '5' },
      { category: 'sci',       cap_pi: '1e3' },
    ] } }, { BUDGET: true }));
    expect(r.budget?.caps).toEqual([{ category: 'ok', cap_pi: '1.00000001' }]);
  });

  it('not served → undefined; served with no caps → an empty month. "Not shared" and "none set" are different answers', () => {
    expect(lifeContextToAi(served({ goals: [] }, { BUDGET: false })).budget).toBeUndefined();
    expect(lifeContextToAi(served({ budget: { period: '2026-10', caps: [] } }, { BUDGET: true })).budget)
      .toEqual({ period: '2026-10', caps: [] });
  });

  it('a malformed period is no budget at all, and at most 12 caps travel', () => {
    expect(lifeContextToAi(served({ budget: { period: 'October', caps: [{ category: 'a', cap_pi: '1' }] } })).budget).toBeUndefined();
    const many = Array.from({ length: 20 }, (_, i) => ({ category: `app${i}`, cap_pi: '1' }));
    expect(lifeContextToAi(served({ budget: { period: '2026-10', caps: many } })).budget?.caps).toHaveLength(12);
  });
});

describe('the signed context carries the budget and re-narrows it', () => {
  it('round-trips for the right user', async () => {
    const budget = { period: '2026-10', caps: [{ category: 'ecommerce', cap_pi: '50' }] };
    const t = await signContext({ kycVerified: true, goals: [], budget }, 'u1', SECRET);
    expect((await verifyContext(t, 'u1', SECRET))?.budget).toEqual(budget);
  });

  it('a token holding a numeric cap or a bad period comes out without it', async () => {
    const bad = await signContext({ kycVerified: true, goals: [], budget: { period: '2026-10', caps: [{ category: 'x', cap_pi: 5 as unknown as string }] } }, 'u1', SECRET);
    expect((await verifyContext(bad, 'u1', SECRET))?.budget).toEqual({ period: '2026-10', caps: [] });
    const badPeriod = await signContext({ kycVerified: true, goals: [], budget: { period: 'nope', caps: [] } }, 'u1', SECRET);
    expect((await verifyContext(badPeriod, 'u1', SECRET))?.budget).toBeUndefined();
  });
});

describe('the prompt line', () => {
  it('names the month and each cap, and says these are limits — not what was spent', () => {
    const line = budgetPromptLine({ period: '2026-10', caps: [{ category: 'ecommerce', cap_pi: '50' }, { category: 'commerce', cap_pi: '12.5' }] });
    expect(line).toContain('2026-10');
    expect(line).toContain('ecommerce ≤ 50 π');
    expect(line).toContain('commerce ≤ 12.5 π');
    expect(line).toMatch(/limits?, not (their )?spending/i);
    expect(line).toMatch(/do not know what they spent/i);
    expect(line).toMatch(/never shame/i);
  });

  it('an empty month says no caps were set; no budget at all says nothing', () => {
    expect(budgetPromptLine({ period: '2026-10', caps: [] })).toMatch(/no caps set for 2026-10/i);
    expect(budgetPromptLine(undefined)).toBe('');
  });

  it('the chat route renders it from the verified claims, and the BFF carries it only when served', () => {
    const chat = read('src/app/api/ai/chat/route.ts');
    const bff  = read('src/app/api/bff/ai/context/route.ts');
    expect(chat).toMatch(/budgetPromptLine\(userContext\?\.budget\)/);
    expect(bff).toMatch(/if \(life\.budget\)\s+out\.budget\s+= life\.budget/);
    expect(bff).toMatch(/budget:\s+c\.budget/);
  });
});
