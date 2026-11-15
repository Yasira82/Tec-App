/**
 * The admin campaign page, checked by phone on 15 Nov 2026.
 *
 * 1. After an Approve the counts above the queue said "1 Waiting · 6 Approved" while
 *    the queue said "0 waiting for review": the funnel was read once, the queue after
 *    every review. A review now reads both again.
 * 2. The Hub's own row ("tec") showed "1 → 0" and a red 0%. The Hub mission is open
 *    from the start, so no app ever confirms an arrival for it; red there is a false
 *    alarm. Its arrival column says "—".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FunnelCard } from '@/app/hub/admin/campaign/FunnelCard';

afterEach(() => { vi.unstubAllGlobals(); });

const report = (status: string) => ({
  id: 'r1', owner: 'p1', app: 'assets', status, report: 'Saw 3 NFTs', had_problem: false, detail: 'Prices clear',
  suggestion: null, review_note: null, revisions: 0, swap_reason: null, reported_at: '2026-11-15T15:00:00Z', evidence: 'partial',
});
const funnel = (waiting: number, approved: number) => ({
  round: '2026-11-15T00:00:00.000Z', counting_since: null, mode: 'pick',
  stages: { viewed: 1, tapped: 1, arrived: 1, qualified: 1, claimed: 1, paid: 1 },
  per_app: [{ app: 'tec', tapped: 1, arrived: 0, assigned: 1, approved: 0, swapped: 0 }, { app: 'zone', tapped: 2, arrived: 1, assigned: 1, approved: 0, swapped: 0 }],
  review: { pioneers: 1, assigned: 0, submitted: waiting, needs_revision: 0, approved, swapped: 0 },
  stop_reasons: [], notes: [],
});

function backend() {
  let approved = false;
  return vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    if (url.endsWith('/review') && init?.method === 'POST') { approved = true; return { ok: true, status: 200, json: async () => ({ success: true }) } as Response; }
    if (url.endsWith('/funnel')) return { ok: true, status: 200, json: async () => ({ data: approved ? funnel(0, 1) : funnel(1, 0) }) } as Response;
    return { ok: true, status: 200, json: async () => ({ data: { reports: [report(approved ? 'APPROVED' : 'SUBMITTED')] } }) } as Response;
  });
}

const count = (label: string) =>
  Array.from(screen.getByTestId('review-counts').children)
    .find((c) => c.lastElementChild?.textContent === label)?.firstElementChild?.textContent;

describe('the admin campaign page after a review', () => {
  it('the counts follow the queue', async () => {
    vi.stubGlobal('fetch', backend());
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByText('Approve')).toBeTruthy());
    expect(count('Waiting')).toBe('1');
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(count('Approved')).toBe('1'));
    expect(count('Waiting')).toBe('0');
  });
});

describe('the Hub\'s own row', () => {
  it('is not shown as an app that loses people', async () => {
    vi.stubGlobal('fetch', backend());
    render(<FunnelCard />);
    await waitFor(() => expect(screen.getByText('1 → —')).toBeTruthy());
    expect(screen.queryByText('1 → 0')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('50%').getAttribute('style')).toContain('var(--tec-red)'); // other apps keep the alarm
  });
});
