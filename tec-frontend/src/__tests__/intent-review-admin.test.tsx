/**
 * A2 — the assistant's missing vocabulary on /hub/admin/life-ai (Tec-App #287;
 * backend Tec-core-backend #389). Pinned: counts with `null` highlighted, the
 * unmatched asks with their excerpts, a failed half said in words (never an
 * empty list that reads as "nothing missing"), no names, the route forwarding the
 * session only, both languages.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntentReviewCard } from '@/app/hub/admin/life-ai/IntentReviewCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const S = en.hub.adminLifeAi.intents;
const respond = (status: number, body: unknown) =>
  vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => ({ ok: status < 400, status, json: async () => body }) as Response);

const OBJ = { total: 5, truncated: false, by_objective: [{ objective: null, count: 3 }, { objective: 'buy_product', count: 2 }] };
const UNM = { matched: 2, truncated: false, observations: [
  { at: '2026-10-06T11:00:00Z', objective: null, excerpt: 'اريد ان اتبرع', constraints: [], locale: 'ar' },
  { at: '2026-10-05T10:00:00Z', objective: null, excerpt: 'can I rent a car with pi', constraints: [], locale: 'en' },
] };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('IntentReviewCard', () => {
  it('shows the counts with "no objective" named, and the unmatched asks', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { weeks: 4, objectives: OBJ, unmatched: UNM, unavailable: {} } }));
    render(<IntentReviewCard strings={S} />);
    await waitFor(() => expect(screen.getByTestId('objective-null').textContent).toContain(S.noObjective));
    expect(screen.getByTestId('objective-null').textContent).toContain('3');
    expect(screen.getByTestId('objective-buy_product').textContent).toContain('2');
    const rows = screen.getAllByTestId('unmatched-row');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('اريد ان اتبرع'), expect.stringContaining('can I rent a car with pi')]);
    expect(screen.queryByTestId('intent-unavailable')).toBeNull();
  });

  it('a window with no unmatched asks says so — a finding, not a blank', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { weeks: 4, objectives: { ...OBJ, by_objective: [{ objective: 'buy_product', count: 2 }, { objective: null, count: 0 }] }, unmatched: { matched: 0, observations: [] }, unavailable: {} } }));
    render(<IntentReviewCard strings={S} />);
    await waitFor(() => expect(screen.getByTestId('unmatched-none').textContent).toBe(S.unmatchedNone));
    expect(screen.getByTestId('objective-null').textContent).toContain('0');
  });

  it('a half that could not be read is said in words with its status — never an empty list', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { weeks: 4, objectives: OBJ, unmatched: null, unavailable: { unmatched: 503 } } }));
    render(<IntentReviewCard strings={S} />);
    await waitFor(() => expect(screen.getByTestId('intent-unavailable').textContent).toContain('503'));
    expect(screen.queryByTestId('unmatched-none')).toBeNull();
    expect(screen.queryAllByTestId('unmatched-row')).toHaveLength(0);
  });

  it('a refusal of the whole route shows the sentence', async () => {
    vi.stubGlobal('fetch', respond(403, { error: 'Forbidden' }));
    render(<IntentReviewCard strings={S} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Forbidden'));
  });

  it('the strings exist in both languages with the same keys', () => {
    expect(Object.keys(ar.hub.adminLifeAi.intents).sort()).toEqual(Object.keys(en.hub.adminLifeAi.intents).sort());
    for (const v of Object.values(ar.hub.adminLifeAi.intents)) expect(v).toBeTruthy();
  });
});

describe('the intents route forwards the user, not a service credential', () => {
  const read   = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
  const route  = read('app/api/admin/life-ai/intents/route.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('never attaches x-internal-key; the session is the only authority; 401 without one', () => {
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
    expect(route).toMatch(/Authorization: `Bearer \$\{token\}`/);
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('reads both endpoints independently; a failed half is null with its status', () => {
    expect(route).toContain('/api/analytics/admin/ai/intent-objectives?weeks=');
    expect(route).toContain('/api/analytics/admin/ai/intent-observations?objective=null&weeks=');
    expect(route).toMatch(/unavailable\.objectives = objectives\.status/);
    expect(route).toMatch(/unavailable\.unmatched\s+= unmatched\.status/);
  });

  it('the page renders the card below the two numbers', () => {
    const page = read('app/hub/admin/life-ai/page.tsx');
    expect(page.indexOf('<IntentReviewCard')).toBeGreaterThan(page.indexOf('<LifeAiCard'));
  });
});
