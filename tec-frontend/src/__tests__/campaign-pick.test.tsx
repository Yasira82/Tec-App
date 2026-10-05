/**
 * Round 3 MVP on the Hub — pick 1 to 3 apps, report on each, one continuity
 * question (KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md §4; tec-app #276).
 *
 * Pins: the picker's bounds, a report is written only for an app the app itself
 * saw the pioneer arrive in, the continuity card is three buttons with nothing to
 * type and can be skipped, and the admin card shows counts — never who answered.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PickMissions, type PickMission } from '@/app/hub/campaign/PickMissions';
import { FunnelCard } from '@/app/hub/admin/campaign/FunnelCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const ok = (body: unknown = { success: true }) =>
  vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => ({ ok: true, status: 200, json: async () => body }) as Response);

const APPS = ['explorer', 'zone', 'commerce', 'assets'];
const setup = (missions: PickMission[], extra: Partial<React.ComponentProps<typeof PickMissions>> = {}) => {
  const onChanged = vi.fn();
  render(
    <PickMissions apps={APPS} missions={missions} rewardPi={1} pickMax={3} continuityAnswered={false}
      strings={en.hub.campaignPage.pick} nameOf={(s) => s.toUpperCase()} linkOf={(s) => `https://${s}.tecosystem.app/app`}
      onOpen={vi.fn()} onChanged={onChanged} {...extra} />,
  );
  return { onChanged };
};
const mission = (app: string, over: Partial<PickMission> = {}): PickMission =>
  ({ app, arrived: false, report: null, reported_at: null, evidence: null, ...over });

afterEach(() => { vi.unstubAllGlobals(); });

describe('picking 1 to 3 apps', () => {
  it('nothing is sent with no app chosen, and a fourth cannot be chosen', () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup([]);
    const start = screen.getByText(/Start with/);
    expect((start as HTMLButtonElement).disabled).toBe(true);
    for (const a of ['EXPLORER', 'ZONE', 'COMMERCE']) fireEvent.click(screen.getByText(a));
    const fourth = screen.getByText('ASSETS').closest('button') as HTMLButtonElement;
    expect(fourth.disabled).toBe(true);
    expect(screen.getByText('Choose your apps (3 of 3)')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('sends the choice to the BFF with the CSRF header, and says the reward up front', async () => {
    document.cookie = 'tec_csrf=tok123';
    const f = ok(); vi.stubGlobal('fetch', f);
    const { onChanged } = setup([]);
    fireEvent.click(screen.getByText('ZONE'));
    fireEvent.click(screen.getByText('EXPLORER'));
    fireEvent.click(screen.getByText('Start with 2 — up to 2 π'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(String(f.mock.calls[0][0])).toBe('/api/bff/campaign/pick');
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ apps: ['zone', 'explorer'] });
    expect((f.mock.calls[0][1]?.headers as Record<string, string>)['x-csrf-token']).toBe('tok123');
  });
});

describe('reporting', () => {
  it('an app not yet arrived in offers the link and no report box', () => {
    setup([mission('zone')]);
    expect(screen.getByText('Open it from here and sign in there')).toBeTruthy();
    expect(screen.queryByText('Send report')).toBeNull();
  });

  it('after the arrival, a report of at least 10 characters is sent', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { onChanged } = setup([mission('zone', { arrived: true })]);
    const box = screen.getByLabelText(/What worked/);
    fireEvent.change(box, { target: { value: 'short' } });
    expect((screen.getByText('Send report') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'The badge page was clear.' } });
    fireEvent.click(screen.getByText('Send report'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ app: 'zone', report: 'The badge page was clear.' });
  });

  it('a refusal shows the service\'s sentence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ message: 'Open zone from this page and sign in there first' }) }) as Response));
    setup([mission('zone', { arrived: true })]);
    fireEvent.change(screen.getByLabelText(/What worked/), { target: { value: 'Something long enough' } });
    fireEvent.click(screen.getByText('Send report'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('sign in there first'));
  });
});

describe('the continuity question — one tap, optional, nothing typed', () => {
  const reported = [mission('zone', { arrived: true, report: 'fine and clear', reported_at: '2026-10-05T10:00:00Z', evidence: 'partial' })];

  it('appears only after a report, with three buttons and no input field', () => {
    setup([mission('zone', { arrived: true })]);
    expect(screen.queryByTestId('continuity-card')).toBeNull();
    document.body.innerHTML = '';
    setup(reported);
    const card = screen.getByTestId('continuity-card');
    expect(card.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(card.querySelectorAll('button')).toHaveLength(4);   // yes · no · not sure · skip
  });

  it('sends one of three answers and does not ask again', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup(reported);
    fireEvent.click(screen.getByText('Not sure'));
    await waitFor(() => expect(screen.queryByTestId('continuity-card')).toBeNull());
    expect(String(f.mock.calls[0][0])).toBe('/api/bff/campaign/continuity');
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ answer: 'not_sure' });
    expect(screen.getByText(/never ask for your passphrase/)).toBeTruthy();
  });

  it('can be skipped, and is not shown once answered', () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    setup(reported);
    fireEvent.click(screen.getByText('Skip'));
    expect(screen.queryByTestId('continuity-card')).toBeNull();
    expect(f).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    setup(reported, { continuityAnswered: true });
    expect(screen.queryByTestId('continuity-card')).toBeNull();
  });
});

describe('the admin funnel — counts, never a person', () => {
  it('shows the 1/2/3 split and the continuity counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => ({
      ok: true, status: 200,
      json: async () => String(u).includes('reports')
        ? { data: { reports: [{ owner: 'p1', app: 'zone', report: 'clear page', reported_at: '2026-10-05T10:00:00Z' }] } }
        : { data: {
            round: '2026-10-05T00:00:00.000Z', mode: 'pick', counting_since: null,
            stages: { viewed: 9, tapped: 6, arrived: 5, qualified: 3, claimed: 2, paid: 1 },
            per_app: [{ app: 'zone', tapped: 6, arrived: 5, picked: 4, reported: 3 }],
            picks: { one: 2, two: 1, three: 1 }, continuity: { yes: 1, no: 0, not_sure: 2 },
            stop_reasons: [], notes: [],
          } },
    }) as Response));
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByTestId('pick-split')).toBeTruthy());
    expect(screen.getByTestId('pick-split').textContent).toBe('21 app12 apps13 apps');
    expect(screen.getByTestId('continuity-counts').textContent).toBe('1Yes0No2Not sure');
    expect(screen.getByTestId('continuity-counts').textContent).not.toContain('p1');
    await waitFor(() => expect(screen.getByText(/clear page/)).toBeTruthy());
  });
});

describe('wiring', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('every Round 3 string exists in Arabic too', () => {
    expect(Object.keys(ar.hub.campaignPage.pick).sort()).toEqual(Object.keys(en.hub.campaignPage.pick).sort());
  });

  it('the BFF routes send the session token, never a name, and the campaign writes are CSRF-checked', () => {
    for (const r of ['pick', 'report', 'continuity']) {
      const src = read(`src/app/api/bff/campaign/${r}/route.ts`);
      expect(src).toContain('requireAuth: true');
      expect(src).not.toMatch(/owner|username|userId/);
    }
    expect(read('src/app/api/bff/campaign/continuity/route.ts')).toContain("z.enum(['yes', 'no', 'not_sure'])");
    expect(read('src/middleware.ts')).toContain("'/api/bff/campaign',");
    expect(read('src/app/api/admin/campaign/reports/route.ts')).not.toMatch(/'x-internal-key':/);
  });
});
