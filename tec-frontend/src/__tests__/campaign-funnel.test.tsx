/**
 * The campaign funnel (Round 3 decision, KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md).
 *
 * The pioneer's side: one card that asks "why did you stop?" in one tap, shows the
 * answer back instead of asking twice, and can be changed. The admin's side: every
 * stage in people with the share that made it from the stage before — and the route
 * that carries it forwards the user's session, never a service credential.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StopReasonCard, type StopReasonStrings } from '@/app/hub/campaign/StopReasonCard';
import { FunnelCard } from '@/app/hub/admin/campaign/FunnelCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const S: StopReasonStrings = {
  title: 'Not going to finish?', note: 'Anything to add?', send: 'Send', thanks: 'Thank you',
  change: 'Change my answer', failed: 'Could not save',
  reasons: { a: 'Too many apps', b: 'Confusing', c: 'Did not work', d: 'No value', e: 'Other' },
};
const ok = (body: unknown) => vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => ({ ok: true, status: 200, json: async () => body }) as Response);

afterEach(() => { vi.unstubAllGlobals(); });

describe('StopReasonCard — why did you stop, in one tap', () => {
  it('sends the chosen reason and the note, then shows the answer back', async () => {
    const f = ok({ success: true, data: {} }); vi.stubGlobal('fetch', f);
    render(<StopReasonCard strings={S} initial={null} />);
    fireEvent.click(screen.getByText('No value'));
    fireEvent.change(screen.getByPlaceholderText('Anything to add?'), { target: { value: 'not sure what TEC is' } });
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(screen.getByTestId('stop-reason-saved')).toBeTruthy());
    expect(String(f.mock.calls[0][0])).toBe('/api/bff/campaign/stop-reason');
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ reason: 'd', note: 'not sure what TEC is' });
    expect(screen.getByText(/not sure what TEC is/)).toBeTruthy();
  });

  it('nothing is sent until a reason is chosen', () => {
    const f = ok({}); vi.stubGlobal('fetch', f);
    render(<StopReasonCard strings={S} initial={null} />);
    fireEvent.click(screen.getByText('Send'));
    expect(f).not.toHaveBeenCalled();
  });

  it('an answer already given is shown, not asked again — and can be changed', () => {
    render(<StopReasonCard strings={S} initial={{ reason: 'a', note: null }} />);
    expect(screen.getByText('Too many apps')).toBeTruthy();
    expect(screen.queryByText('Send')).toBeNull();
    fireEvent.click(screen.getByText('Change my answer'));
    expect(screen.getByText('Send')).toBeTruthy();
  });

  it('a refusal shows the service\'s sentence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'You have already claimed' }) }) as Response));
    render(<StopReasonCard strings={S} initial={null} />);
    fireEvent.click(screen.getByText('Other'));
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('You have already claimed'));
  });

  it('the five reasons exist in both languages', () => {
    for (const t of [en, ar]) {
      const s = t.hub.campaignPage.stopReason;
      for (const k of ['title', 'a', 'b', 'c', 'd', 'e', 'note', 'send', 'thanks', 'change', 'failed'] as const) expect(s[k]).toBeTruthy();
    }
  });
});

describe('FunnelCard — where people are lost', () => {
  it('shows every stage in people, with the share that made it from the stage before', async () => {
    vi.stubGlobal('fetch', ok({ data: {
      round: '2026-10-01T00:00:00.000Z', counting_since: '2026-10-04T10:00:00.000Z',
      stages: { viewed: 40, tapped: 20, arrived: 15, qualified: 6, claimed: 5, paid: 5 },
      per_app: [{ app: 'zone', tapped: 20, arrived: 9 }],
      stop_reasons: [{ reason: 'a', label: 'Too many apps / too long', count: 4 }, { reason: 'd', label: 'Did not see enough value', count: 2 }],
      notes: [{ reason: 'c', note: 'zone never loaded', at: '2026-10-04T11:00:00.000Z' }],
    } }));
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByText('Opened the page')).toBeTruthy());
    expect(screen.getByText('50%')).toBeTruthy();                 // 20 of 40 tapped
    expect(screen.getByText('20 → 9')).toBeTruthy();
    expect(screen.getByText('45%').getAttribute('style')).toContain('var(--tec-red)');  // zone loses people
    expect(screen.getByText(/zone never loaded/)).toBeTruthy();
  });

  it('says so when the funnel cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ message: 'Admin only' }) }) as Response));
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Admin only'));
  });
});

describe('the admin funnel route forwards the user, not a service credential', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/admin/campaign/funnel/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  it('never attaches x-internal-key (the service would skip its role check)', () => {
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });
});

describe('StopReasonCard — collapsed while the pioneer is mid-mission', () => {
  it('shows one line, not five reasons, and opens on tap', () => {
    render(<StopReasonCard strings={{ ...S, open: 'Not going to finish? Tell us why' }} initial={null} collapsed />);
    expect(screen.queryByText('Too many apps')).toBeNull();
    fireEvent.click(screen.getByTestId('stop-reason-open'));
    expect(screen.getByText('Too many apps')).toBeTruthy();
  });

  it('an answer already given is still shown back, collapsed or not', () => {
    render(<StopReasonCard strings={S} initial={{ reason: 'a', note: null }} collapsed />);
    expect(screen.getByTestId('stop-reason-saved')).toBeTruthy();
  });
});
