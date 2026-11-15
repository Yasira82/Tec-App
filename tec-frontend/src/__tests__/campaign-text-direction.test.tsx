/**
 * A pioneer's own words are shown in their own direction.
 *
 * The Round 3 phone check (15 Nov 2026) sent an Arabic report. On the campaign page the
 * Arabic ran into the English label and the quote marks around it: the closing quote
 * landed at the start, and "Marketplace 3" / "50 π" moved inside the sentence. Most
 * pioneers write Arabic. Each text a pioneer typed is now isolated with
 * `<bdi dir="auto">`: the browser takes its direction from the text itself, and the
 * label and quotes around it stay where they are. The text boxes take `dir="auto"` for
 * the same reason, while typing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PickMissions, type PickMission } from '@/app/hub/campaign/PickMissions';
import { ReportReview } from '@/app/hub/admin/campaign/ReportReview';
import { en } from '@/lib/i18n/en';

const AR_REPORT  = 'فتحت Marketplace ولقيت 3 NFTs معروضة بأسعارها (TEC Genesis Apex بـ 50π).';
const AR_DETAIL  = 'الأسعار كانت مكتوبة جنب كل NFT بوضوح.';
const AR_SUGGEST = 'لو فيه رسالة في Portfolio وهو فاضي.';

/** The element that holds exactly this text must be an isolate whose direction is the text's. */
const isolated = (text: string) => {
  const el = screen.getByText(text);
  expect(el.tagName).toBe('BDI');
  expect(el.getAttribute('dir')).toBe('auto');
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('the campaign page', () => {
  const mission: PickMission = {
    app: 'assets', status: 'SUBMITTED', arrived: true, report: AR_REPORT, had_problem: false,
    detail: AR_DETAIL, suggestion: AR_SUGGEST, reported_at: '2026-11-15T14:59:00Z', evidence: 'partial',
  } as PickMission;

  it('a sent report: each of the pioneer\'s texts is its own isolate', () => {
    render(
      <PickMissions assigned count={6} missions={[mission]} swapsLeft={0} rewardPi={0.85}
        strings={en.hub.campaignPage.pick} nameOf={(s) => s} linkOf={(s) => `https://${s}.tecosystem.app/app`}
        onOpen={vi.fn()} onChanged={vi.fn()} />,
    );
    isolated(AR_REPORT);
    isolated(AR_DETAIL);
    isolated(AR_SUGGEST);
  });

  it('the text boxes follow what is typed in them', () => {
    render(
      <PickMissions assigned count={6} missions={[{ ...mission, status: 'ASSIGNED', report: null, detail: null, suggestion: null }]}
        swapsLeft={0} rewardPi={0.85} strings={en.hub.campaignPage.pick} nameOf={(s) => s}
        linkOf={(s) => `https://${s}.tecosystem.app/app`} onOpen={vi.fn()} onChanged={vi.fn()} />,
    );
    const boxes = document.querySelectorAll('textarea');
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach((b) => expect(b.getAttribute('dir')).toBe('auto'));
  });
});

describe('the owner\'s review queue', () => {
  it('each of the pioneer\'s texts is its own isolate', async () => {
    const REPORTS = [{
      id: '11111111-1111-1111-1111-111111111111', owner: 'p1', app: 'assets', status: 'NEEDS_REVISION',
      report: AR_REPORT, had_problem: false, detail: AR_DETAIL, suggestion: AR_SUGGEST,
      review_note: 'اكتب اسم NFT تاني.', revisions: 1, swap_reason: null, reported_at: '2026-11-15T14:59:00Z',
    }];
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => ({
      ok: true, status: 200, json: async () => (String(u).endsWith('/reports') ? { data: { reports: REPORTS } } : { success: true }),
    }) as Response));
    render(<ReportReview />);
    await waitFor(() => expect(screen.getByText(AR_REPORT)).toBeTruthy());
    isolated(AR_REPORT);
    isolated(AR_DETAIL);
    isolated(AR_SUGGEST);
    isolated('اكتب اسم NFT تاني.');
  });
});
