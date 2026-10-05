/**
 * Round 3 on the Hub — three assigned apps, a report on each, the owner reviews
 * (KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md §4b, owner 2026-10-05).
 *
 * Pins: the apps are assigned (one button, no picker); the report form — what
 * happened, a problem yes/no, the detail either way, an optional suggestion;
 * the owner's note on a revision and the resend; the swap needs a reason; the
 * admin queue approves or asks for a revision with a note; and the wiring.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PickMissions, type PickMission } from '@/app/hub/campaign/PickMissions';
import { ReportReview } from '@/app/hub/admin/campaign/ReportReview';
import { FunnelCard } from '@/app/hub/admin/campaign/FunnelCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const ok = (body: unknown = { success: true }) =>
  vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => ({ ok: true, status: 200, json: async () => body }) as Response);

const setup = (missions: PickMission[], extra: Partial<React.ComponentProps<typeof PickMissions>> = {}) => {
  const onChanged = vi.fn();
  render(
    <PickMissions assigned={missions.length > 0} count={3} missions={missions} swapsLeft={2} rewardPi={1}
      strings={en.hub.campaignPage.pick} nameOf={(s) => s.toUpperCase()} linkOf={(s) => `https://${s}.tecosystem.app/app`}
      onOpen={vi.fn()} onChanged={onChanged} {...extra} />,
  );
  return { onChanged };
};
const mission = (app: string, over: Partial<PickMission> = {}): PickMission =>
  ({ app, status: 'ASSIGNED', arrived: false, report: null, reported_at: null, evidence: null, ...over });
const body = (f: ReturnType<typeof ok>, n = 0) => JSON.parse(String(f.mock.calls[n][1]?.body));

afterEach(() => { vi.unstubAllGlobals(); });

describe('assignment — the service chooses, the screen asks once', () => {
  it('before assignment: the criteria and one button, which asks the service', async () => {
    document.cookie = 'tec_csrf=tok123';
    const f = ok(); vi.stubGlobal('fetch', f);
    const { onChanged } = setup([]);
    expect(screen.getByTestId('criteria').textContent).toContain('not asking you to criticise TEC');
    fireEvent.click(screen.getByText('Get my 3 apps'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(String(f.mock.calls[0][0])).toBe('/api/bff/campaign/assign');
    expect((f.mock.calls[0][1]?.headers as Record<string, string>)['x-csrf-token']).toBe('tok123');
  });
});

describe('the report form', () => {
  it('an app not yet arrived in offers the link and no form', () => {
    setup([mission('zone')]);
    expect(screen.getByText('Open it from here and sign in there with Pi')).toBeTruthy();
    expect(screen.queryByText('Send report')).toBeNull();
  });

  it('a report with no problem asks what was clear or useful — and is sent whole', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { onChanged } = setup([mission('zone', { arrived: true })]);
    fireEvent.change(screen.getByLabelText('What happened while you used the app?'), { target: { value: 'I signed in and opened the map.' } });
    expect((screen.getByText('Send report') as HTMLButtonElement).disabled).toBe(true);   // no yes/no yet
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.change(screen.getByLabelText('What did you find clear or useful?'), { target: { value: 'The badge page was clear.' } });
    fireEvent.click(screen.getByText('Send report'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(body(f)).toEqual({ app: 'zone', observed: 'I signed in and opened the map.', had_problem: false, detail: 'The badge page was clear.' });
  });

  it('a problem asks where and what happened; the suggestion is optional and sent when written', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup([mission('zone', { arrived: true })]);
    fireEvent.change(screen.getByLabelText('What happened while you used the app?'), { target: { value: 'I tried to verify a shop.' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByLabelText(/What was the problem/), { target: { value: 'The submit button did nothing.' } });
    fireEvent.change(screen.getByLabelText('What would you change or add? (optional)'), { target: { value: 'Show a loading state' } });
    fireEvent.click(screen.getByText('Send report'));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(body(f)).toMatchObject({ had_problem: true, detail: 'The submit button did nothing.', suggestion: 'Show a loading state' });
  });

  it('needs revision: the owner\'s note is shown and the report can be sent again', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup([mission('zone', {
      arrived: true, status: 'NEEDS_REVISION', report: 'Opened it.', had_problem: false, detail: 'It was fine overall.',
      review_note: 'Which screen was clear? Name it.', reported_at: '2026-10-05T10:00:00Z',
    })]);
    expect(screen.getByTestId('note-zone').textContent).toContain('Which screen was clear? Name it.');
    expect(screen.getByText('Please add a little more — see the note')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('What did you find clear or useful?'), { target: { value: 'The Verified list screen was clear.' } });
    fireEvent.click(screen.getByText('Send again'));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(body(f)).toMatchObject({ detail: 'The Verified list screen was clear.' });
  });

  it('approved is final: shown, with no form', () => {
    setup([mission('zone', { arrived: true, status: 'APPROVED', report: 'Opened it.', had_problem: false, detail: 'Clear menu.', reported_at: '2026-10-05T10:00:00Z' })]);
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByText('Send report')).toBeNull();
    expect(screen.queryByText('Send again')).toBeNull();
  });
});

describe('swap — a technical problem, with the reason', () => {
  it('needs a reason of 10 characters, then sends it', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup([mission('titan')]);
    fireEvent.click(screen.getByText(/Swap this app \(2 left\)/));
    fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'white' } });
    expect((screen.getByText('Swap it') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'The page stays white after sign-in.' } });
    fireEvent.click(screen.getByText('Swap it'));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(String(f.mock.calls[0][0])).toBe('/api/bff/campaign/swap');
    expect(body(f)).toEqual({ app: 'titan', reason: 'The page stays white after sign-in.' });
  });

  it('is not offered once a report was sent, or with no swaps left', () => {
    setup([mission('titan', { arrived: true, status: 'SUBMITTED', report: 'x', reported_at: '2026-10-05T10:00:00Z' })]);
    expect(screen.queryByText(/Swap this app/)).toBeNull();
    document.body.innerHTML = '';
    setup([mission('titan')], { swapsLeft: 0 });
    expect(screen.queryByText(/Swap this app/)).toBeNull();
  });
});

describe('the owner\'s review queue', () => {
  const REPORTS = [
    { id: '11111111-1111-1111-1111-111111111111', owner: 'p1', app: 'zone', status: 'SUBMITTED', report: 'I opened the verify page.', had_problem: true,
      detail: 'Submit did nothing.', suggestion: 'Add a spinner', review_note: null, revisions: 0, swap_reason: null, reported_at: '2026-10-05T10:00:00Z' },
    { id: '22222222-2222-2222-2222-222222222222', owner: 'p2', app: 'titan', status: 'SWAPPED', report: null, had_problem: null,
      detail: null, suggestion: null, review_note: null, revisions: 0, swap_reason: 'White page after sign-in.', reported_at: null },
  ];
  const queue = () => {
    const f = vi.fn(async (u: RequestInfo | URL, _i?: RequestInit) => ({
      ok: true, status: 200, json: async () => (String(u).endsWith('/reports') ? { data: { reports: REPORTS } } : { success: true }),
    }) as Response);
    vi.stubGlobal('fetch', f);
    return f;
  };

  it('shows the whole report and the swaps; approve sends approve', async () => {
    const f = queue();
    render(<ReportReview />);
    await waitFor(() => expect(screen.getByText(/Submit did nothing/)).toBeTruthy());
    expect(screen.getByText(/1 waiting for review/)).toBeTruthy();
    expect(screen.getByText(/Suggestion: “Add a spinner”/)).toBeTruthy();
    expect(screen.getByText(/White page after sign-in/)).toBeTruthy();
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/review'))).toBe(true));
    const call = f.mock.calls.find(([u]) => String(u).includes('/review'))!;
    expect(String(call[0])).toBe(`/api/admin/campaign/reports/${REPORTS[0].id}/review`);
    expect(JSON.parse(String(call[1]?.body))).toEqual({ action: 'approve' });
  });

  it('needs revision asks for a note the pioneer will read', async () => {
    const f = queue();
    render(<ReportReview />);
    await waitFor(() => expect(screen.getByText('Needs revision')).toBeTruthy());
    fireEvent.click(screen.getByText('Needs revision'));
    expect((screen.getByText('Send the note') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Revision note'), { target: { value: 'Which page? Name it.' } });
    fireEvent.click(screen.getByText('Send the note'));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/review'))).toBe(true));
    const call = f.mock.calls.find(([u]) => String(u).includes('/review'))!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ action: 'revise', note: 'Which page? Name it.' });
  });

  it('the funnel card shows the review counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => ({
      ok: true, status: 200,
      json: async () => String(u).includes('reports')
        ? { data: { reports: [] } }
        : { data: {
            round: '2026-10-05T00:00:00.000Z', mode: 'pick', counting_since: null,
            stages: { viewed: 9, tapped: 6, arrived: 5, qualified: 3, claimed: 2, paid: 1 },
            per_app: [{ app: 'zone', tapped: 6, arrived: 5, assigned: 4, approved: 2, swapped: 1 }],
            review: { pioneers: 4, assigned: 3, submitted: 2, needs_revision: 1, approved: 5, swapped: 1 },
            stop_reasons: [], notes: [],
          } },
    }) as Response));
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByTestId('review-counts')).toBeTruthy());
    expect(screen.getByTestId('review-counts').textContent).toBe('3Assigned2Waiting1Revision5Approved1Swapped');
  });
});

describe('the owner\'s round — six apps', () => {
  it('says how many apps the round gives', () => {
    setup([], { count: 6 });
    expect(screen.getByText('Get my 6 apps')).toBeTruthy();
  });
});

describe('wiring', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('every Round 3 string exists in Arabic too', () => {
    expect(Object.keys(ar.hub.campaignPage.pick).sort()).toEqual(Object.keys(en.hub.campaignPage.pick).sort());
  });

  it('the BFF routes send the session token, never a name; the campaign writes are CSRF-checked', () => {
    for (const r of ['assign', 'swap', 'report']) {
      const src = read(`src/app/api/bff/campaign/${r}/route.ts`);
      expect(src).toContain('requireAuth: true');
      expect(src).not.toMatch(/owner|username|userId/);
    }
    expect(read('src/app/api/bff/campaign/report/route.ts')).toContain('had_problem: z.boolean()');
    expect(read('src/middleware.ts')).toContain("'/api/bff/campaign',");
    expect(read('src/middleware.ts')).toContain("'/api/admin',");
    for (const p of ['src/app/api/admin/campaign/reports/route.ts', 'src/app/api/admin/campaign/reports/[id]/review/route.ts']) {
      expect(read(p)).not.toMatch(/'x-internal-key':/);
    }
  });
});
