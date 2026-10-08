/**
 * The assistant reads Life through the consent-gated door, and nothing else.
 *
 * Owner, 2026-10-06: the Hub assistant fed a person's goals to the model while
 * Life's Privacy screen said goals were NOT shared with TEC AI. C-106 §5 makes
 * the grant a precondition; Life's `/context/:username` serves only granted
 * categories and audits the reader. This pins the reader to that door.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lifeContextToAi } from '@/lib/ai/life-context';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('lifeContextToAi narrows what Life served', () => {
  it('goals granted → titles, marked active; the consent map travels along', () => {
    const r = lifeContextToAi({ success: true, data: {
      consent: [{ category: 'GOALS', granted: true }, { category: 'SKILLS', granted: false }],
      context: { goals: [{ id: 'g1', title: 'Save 100 π', progress: 10, target_amount: 100 }] },
    } });
    expect(r.goals).toEqual([{ title: 'Save 100 π', done: false }]);
    expect(r.consent).toEqual({ GOALS: true, SKILLS: false });
  });

  it('goals NOT granted → no goals, even if a stray `goals` key appears elsewhere', () => {
    const r = lifeContextToAi({ data: { consent: [{ category: 'GOALS', granted: false }], context: {} } });
    expect(r.goals).toEqual([]);
    expect(r.consent.GOALS).toBe(false);
  });

  it('preferences granted → the stated focus; otherwise undefined', () => {
    expect(lifeContextToAi({ data: { consent: [], context: { preferences: { focus: 'saving' } } } }).focus).toBe('saving');
    expect(lifeContextToAi({ data: { consent: [], context: {} } }).focus).toBeUndefined();
  });

  it('a 404 / null / garbage answer is an empty context, never a throw', () => {
    for (const v of [null, undefined, 'nope', 42, { data: 'x' }, { data: { context: { goals: 'x' } } }]) {
      expect(lifeContextToAi(v)).toEqual({ goals: [], focus: undefined, consent: {} });
    }
  });

  it('caps at five goals and drops untitled rows', () => {
    const goals = [...Array(8)].map((_, i) => ({ title: `g${i}` })).concat([{ title: '' }, {} as { title: string }]);
    expect(lifeContextToAi({ data: { consent: [], context: { goals } } }).goals).toHaveLength(5);
  });
});

describe('the BFF context route uses the gated door', () => {
  const bff = read('src/app/api/bff/ai/context/route.ts');

  it('reads /identity/life/context/:username and names itself to the audit', () => {
    expect(bff).toMatch(/\/api\/identity\/life\/context\/\$\{encodeURIComponent\(username\)\}/);
    expect(bff).toContain("'x-service-name': 'tec-app-ai'");
    expect(bff).toContain('lifeContextToAi(lifeRaw)');
  });

  it('never reads the goals or preferences tables as the user again', () => {
    expect(bff).not.toMatch(/\/api\/identity\/life\/goals/);
    expect(bff).not.toMatch(/\/api\/identity\/life\/preferences/);
  });

  it('asks Life nothing when the session has no username to ask about', () => {
    expect(bff).toMatch(/username\s*\?\s*getJson(Status)?\(/);
  });
});
