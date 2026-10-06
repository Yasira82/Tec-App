/**
 * M1 — the two numbers on /hub/admin (Tec-App #285; backend Tec-core-backend #387).
 *
 * Consent coverage (C-106 §8) and assistant usage, counts only. Pinned: a half that
 * could not be read says so and NEVER renders as 0 (C-47 §10 E1); the route forwards
 * the session only, never a service credential; the strings exist in both languages.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LifeAiCard } from '@/app/hub/admin/life-ai/LifeAiCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const S = en.hub.adminLifeAi;

const consent = {
  users_with_any: 4,
  per_category:   { GOALS: 4, SKILLS: 1, PREFERENCES: 2, ACTIVITY: 0, TRAJECTORY: 0, INTENT: 0 },
  categories:     ['GOALS', 'SKILLS', 'PREFERENCES', 'ACTIVITY', 'TRAJECTORY', 'INTENT'],
};
const usage = {
  weeks: 2, since: '2026-09-28T00:00:00.000Z',
  by_week: [
    { week: '2026-W40', start: '2026-09-28T00:00:00.000Z', messages: 0,  users: 0 },
    { week: '2026-W41', start: '2026-10-05T00:00:00.000Z', messages: 12, users: 3 },
  ],
  totals: { messages: 12, users: 3 },
};

const respond = (status: number, body: unknown) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);

afterEach(() => { vi.unstubAllGlobals(); });

describe('LifeAiCard — the two numbers, counts only', () => {
  it('renders coverage with every category and usage per week with totals', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { consent, usage, unavailable: {} } }));
    render(<LifeAiCard strings={S} />);
    await waitFor(() => expect(screen.getByTestId('consent-any').textContent).toBe('4'));

    for (const c of consent.categories) expect(screen.getByTestId(`consent-${c}`)).toBeTruthy();
    expect(screen.getByTestId('consent-GOALS').textContent).toContain('Goals');
    expect(screen.getByTestId('consent-GOALS').textContent).toContain('4');
    expect(screen.getByTestId('consent-ACTIVITY').textContent).toContain('0'); // zero is shown, not hidden

    expect(screen.getByTestId('usage-messages').textContent).toBe('12');
    expect(screen.getByTestId('usage-people').textContent).toBe('3');
    expect(screen.getByTestId('usage-2026-W40').textContent).toContain('0 · 0');
    expect(screen.getByTestId('usage-2026-W41').textContent).toContain('12 · 3');
    expect(screen.queryByTestId('life-ai-unavailable')).toBeNull();
  });

  it('a half that could not be read says so — it never renders as 0', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { consent: null, usage, unavailable: { consent: 503 } } }));
    render(<LifeAiCard strings={S} />);
    await waitFor(() => expect(screen.getByTestId('usage-messages').textContent).toBe('12'));
    const u = screen.getByTestId('life-ai-unavailable');
    expect(u.textContent).toContain(S.unavailable);
    expect(u.textContent).toContain('503');
    expect(screen.queryByTestId('consent-any')).toBeNull();
  });

  it('a refusal of the whole route shows the service\'s sentence, not numbers', async () => {
    vi.stubGlobal('fetch', respond(403, { error: 'Forbidden' }));
    render(<LifeAiCard strings={S} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Forbidden'));
    expect(screen.queryByTestId('consent-any')).toBeNull();
    expect(screen.queryByTestId('usage-messages')).toBeNull();
  });

  it('asks the BFF with the session, not a service credential', async () => {
    const f = respond(200, { success: true, data: { consent, usage, unavailable: {} } });
    vi.stubGlobal('fetch', f);
    render(<LifeAiCard strings={S} />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('/api/admin/life-ai');
    expect(init.credentials).toBe('include');
    expect(JSON.stringify(init.headers ?? {})).not.toContain('internal');
  });

  it('the strings exist in both languages, every category named', () => {
    for (const t of [en, ar]) {
      const s = t.hub.adminLifeAi;
      for (const k of ['title', 'subtitle', 'restricted', 'restrictedSub', 'consentTitle', 'consentSub', 'anyGrant', 'perCategory', 'usageTitle', 'usageSub', 'messages', 'people', 'total', 'unavailable'] as const) {
        expect(s[k]).toBeTruthy();
      }
      for (const c of consent.categories) expect(s.categories[c]).toBeTruthy();
      expect(t.hub.profile.adminLifeAi).toBeTruthy();
      expect(t.hub.profile.adminLifeAiSub).toBeTruthy();
    }
    expect(Object.keys(ar.hub.adminLifeAi).sort()).toEqual(Object.keys(en.hub.adminLifeAi).sort());
  });
});

describe('the life-ai route forwards the user, not a service credential', () => {
  const read   = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
  const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const route  = codeOf('app/api/admin/life-ai/route.ts');

  it('never attaches x-internal-key', () => {
    // Both services read that header as a ServiceActor credential and skip the role
    // check — attaching it would hand the numbers to any signed-in visitor.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('sends the session token as the only authority, and refuses without one', () => {
    expect(route).toMatch(/Authorization: `Bearer \$\{token\}`/);
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('reads the two sources independently and reports a failed half as null with its status — never as zeros', () => {
    expect(route).toContain("'/api/identity/life/admin/consent-coverage'");
    expect(route).toContain('/api/analytics/admin/ai/usage?weeks=');
    expect(route).toMatch(/unavailable\.consent = consent\.status/);
    expect(route).toMatch(/unavailable\.usage\s+= usage\.status/);
    expect(route).not.toMatch(/users_with_any:\s*0|messages:\s*0/);
  });

  it('the profile links the page for admins only', () => {
    const profile = read('app/hub/profile/page.tsx');
    const adminBlock = profile.slice(profile.indexOf("user?.role === 'admin'"));
    expect(adminBlock).toContain("router.push('/hub/admin/life-ai')");
  });
});
