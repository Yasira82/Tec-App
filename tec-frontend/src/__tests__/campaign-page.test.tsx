/**
 * The campaign page, rendered against the REAL response shapes.
 *
 * Reported from a phone: eight apps opened, eight still ○, and the claim form
 * never reachable. The cause was a shape, not a domain:
 *
 *     setMe(m?.data ?? null);        // ← `me` has no `data` key
 *
 * `/api/bff/campaign/status` is a plain route that passes the SERVICE body
 * through, so it arrives WRAPPED: `{ success, data }`. `/api/bff/campaign/me`
 * goes through `createHandler`, which responds with the handler's return value
 * at the TOP LEVEL. Reading `m.data` there is always `undefined`, so `me` was
 * null forever — no ticks, no Connection hint, no claim form.
 *
 * The lesson is the one C-02 already records from the fleet-wide Pro incident:
 * a BFF unit test is only as good as the shape it mocks. The source-grep tests
 * in campaign-ui.test.ts could not catch this and did not; these mock BOTH
 * envelopes exactly as the routes really answer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@/test-utils/render-with-locale';

const { mockUsePiAuth } = vi.hoisted(() => ({ mockUsePiAuth: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));

import CampaignPage from '@/app/hub/campaign/page';

/** Exactly what the status route answers: the service body, passed through. */
const STATUS_BODY = {
  success: true,
  data: {
    reward_pi: 1,
    seats:     100,
    claimed:   0,
    remaining: 100,
    paid:      0,
    apps:      ['connection', 'zone'],
    open:      true,
    connection_invite_url: 'https://connection.tecosystem.app/app?invite=abc',
  },
};

/** Exactly what createHandler answers: the handler's value, TOP LEVEL. */
const ME_BODY = {
  apps:        ['connection', 'zone'],
  action_apps: ['connection'],
  connection_invite_url: 'https://connection.tecosystem.app/app?invite=abc',
  done:        ['zone'],
  missing:     ['connection'],
  eligible:    false,
  reward_pi:   1,
  claim:       null,
};

const answer = (me: unknown = ME_BODY) =>
  vi.fn((url: string) =>
    Promise.resolve({
      ok:   true,
      json: () => Promise.resolve(String(url).includes('/campaign/me') ? me : STATUS_BODY),
    } as Response),
  );

beforeEach(() => {
  mockUsePiAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { username: 'alice' } });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('the campaign page reads the shape each route actually returns', () => {
  it('ticks a finished mission', async () => {
    vi.stubGlobal('fetch', answer());
    render(<CampaignPage />);
    // `zone` is in `done`. Before the fix `me` was null and NOTHING was ever
    // ticked, however much work the pioneer had done.
    await waitFor(() => expect(screen.getByText('✅')).toBeInTheDocument());
  });

  it('shows the Connection hint, which only renders when `me` loaded', async () => {
    vi.stubGlobal('fetch', answer());
    render(<CampaignPage />);
    await waitFor(() =>
      expect(screen.getByText(/puts you in the TEC group/i)).toBeInTheDocument(),
    );
  });

  it('sends the Connection mission to the invite link', async () => {
    vi.stubGlobal('fetch', answer());
    const { container } = render(<CampaignPage />);
    await waitFor(() => {
      const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      // `&q=2` is the return marker: it tells Connection this visitor came from
      // the campaign, so the app can render a way back to /hub/campaign. Pi
      // Browser has no tabs and the back button walks the app's SSO chain, so
      // without it a pioneer who taps this mission has no route home.
      //
      // Pinned WITH the invite param, in this order, because both matter: the
      // invite is what makes it one tap, and the marker is what makes it
      // survivable.
      expect(hrefs).toContain('https://connection.tecosystem.app/app?invite=abc&q=2');
    });
  });

  it('reaches the claim step once every mission is done', async () => {
    const posted = 'GAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCF6M';
    vi.stubGlobal('fetch', answer({
      ...ME_BODY, done: ['connection', 'zone'], missing: [], eligible: true,
      posted_address: posted,
    }));
    render(<CampaignPage />);
    // The address is READ BACK, not typed — it came from their own message in
    // the TEC group. Showing it is the safety of the whole flow: a payout
    // destination nobody saw is one nobody can catch being wrong.
    await waitFor(() => expect(screen.getByText(posted)).toBeInTheDocument());
    // Matched on a CONTIGUOUS fragment: "never" sits in its own <strong>, so a
    // matcher spanning it looks for one text node that does not exist.
    expect(screen.getByText(/ask for your passphrase/i)).toBeInTheDocument();
  });

  it('treats an ERROR body as unknown, not as "has done nothing"', async () => {
    // createHandler answers `{ error, message }` on failure. Mistaking that for
    // a real payload would tick nothing and claim to know why (P6).
    vi.stubGlobal('fetch', answer({ error: 'UNAUTHORIZED', message: 'no session' }));
    render(<CampaignPage />);
    await waitFor(() => expect(screen.getByText(/Finish the list above/i)).toBeInTheDocument());
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
  });
});

/**
 * Claiming without a button.
 *
 * The seat is taken the moment there is nothing left to decide — the missions
 * are done and an address is on record. A confirm step there only exists to be
 * forgotten, and it used to be the last thing between a pioneer and their Pi.
 *
 * Two properties, and the second is the one that costs money if it breaks.
 */
describe('the seat is taken by itself', () => {
  const POSTED = 'GAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCF6M';
  const READY  = {
    ...ME_BODY, done: ['connection', 'zone'], missing: [], eligible: true,
    posted_address: POSTED,
  };

  const posts = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => String(c[0]).includes('/campaign/claim')
      && (c[1] as RequestInit | undefined)?.method === 'POST');

  it('claims once every mission is done and an address is posted', async () => {
    vi.stubGlobal('fetch', answer(READY));
    render(<CampaignPage />);
    await waitFor(() => expect(posts().length).toBe(1));
    // And it sends NOTHING: the service derives the owner from the token and
    // the address from the group message.
    expect((posts()[0][1] as RequestInit).body).toBeUndefined();
  });

  it('claims ONCE, however many times the page re-renders', async () => {
    // Two effects racing here would take two seats, and there is no undo for
    // the second one that is cheap.
    vi.stubGlobal('fetch', answer(READY));
    const { rerender } = render(<CampaignPage />);
    await waitFor(() => expect(posts().length).toBe(1));
    rerender(<CampaignPage />);
    rerender(<CampaignPage />);
    await waitFor(() => expect(posts().length).toBe(1));
  });

  it('does NOT claim while a mission is still open', async () => {
    vi.stubGlobal('fetch', answer({ ...READY, missing: ['connection'], eligible: false }));
    render(<CampaignPage />);
    await waitFor(() => expect(screen.getByText(/Finish the list above/i)).toBeInTheDocument());
    expect(posts()).toHaveLength(0);
  });

  it('does NOT claim when no address was posted', async () => {
    // Eligible, and nowhere to send it. Claiming here would take a seat that
    // can never be paid.
    vi.stubGlobal('fetch', answer({ ...READY, posted_address: null }));
    render(<CampaignPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(posts()).toHaveLength(0);
  });

  it('does NOT claim again when they already hold a seat', async () => {
    vi.stubGlobal('fetch', answer({
      ...READY,
      claim: { seat: 1, status: 'CLAIMED', wallet_address: POSTED, tx_id: null, paid_at: null },
    }));
    render(<CampaignPage />);
    await waitFor(() => expect(screen.getByText(/Seat #1 is yours/i)).toBeInTheDocument());
    expect(posts()).toHaveLength(0);
  });
});

/**
 * The campaign records its own visits — and does not finish the Founding Quest.
 *
 * Reported from a phone: tap the missions here, they tick (correct); then open
 * `/pioneers` and ITS apps are already marked done. The pioneer never tapped
 * them there, and the Founding badge that page asks them to earn was being
 * handed over for work it never saw.
 *
 * One endpoint served both pages, so every open landed in the same
 * `opened_apps`. This page had already been given the mirror-image fix in the
 * other direction — its `CampaignVisit` rows are timestamped so an old Founding
 * visit cannot claim fresh Pi. `origin: 'campaign'` is that fix pointing back.
 */
describe('a mission tap is a campaign visit and nothing else', () => {
  const opens = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => String(c[0]).includes('/pioneer/open'));

  it('declares its origin, so the Founding Quest is left alone', async () => {
    vi.stubGlobal('fetch', answer());
    const { container } = render(<CampaignPage />);
    await waitFor(() => expect(container.querySelectorAll('a').length).toBeGreaterThan(0));

    const mission = [...container.querySelectorAll('a')]
      .find((a) => a.getAttribute('href')?.includes('zone.tecosystem.app'));
    expect(mission).toBeTruthy();
    mission!.click();

    await waitFor(() => expect(opens().length).toBe(1));
    const body = JSON.parse(String((opens()[0][1] as RequestInit).body));
    expect(body).toMatchObject({ app: 'zone', origin: 'campaign' });
  });
});

/**
 * A tap the server never received.
 *
 * These mission links leave the page, and a fetch in flight when the browser
 * navigates is cancelled. `keepalive` covers most of that; nothing covers all
 * of it — and a campaign visit can no longer be opened by the app's own arrival
 * report, because that report fires on any page load from any entry and would
 * hand a mission to anyone who merely loaded the app. So the rescue has to
 * happen here.
 */
describe('a lost mission tap is re-sent', () => {
  const opens = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => String(c[0]).includes('/pioneer/open'));

  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('re-sends a mission this page tapped that the server does not show as done', async () => {
    localStorage.setItem('tec_campaign_tapped', JSON.stringify(['zone']));
    // `ME_BODY` marks `zone` done, which is the opposite of the case under
    // test — so the server here reports nothing done at all.
    vi.stubGlobal('fetch', answer({ ...ME_BODY, done: [], missing: ['connection', 'zone'] }));
    render(<CampaignPage />);
    await waitFor(() => expect(opens().length).toBe(1));
    expect(JSON.parse(String((opens()[0][1] as RequestInit).body)))
      .toMatchObject({ app: 'zone', origin: 'campaign' });
  });

  it('does NOT re-send one the server already counted', async () => {
    localStorage.setItem('tec_campaign_tapped', JSON.stringify(['zone']));
    vi.stubGlobal('fetch', answer());           // ME_BODY: zone is done
    render(<CampaignPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(opens()).toHaveLength(0);
  });

  it('re-sends at most once, however many times the page re-renders', async () => {
    // `connection` needs a message sent as well as a visit, so it can sit in
    // `missing` after a perfectly good tap. Without the guard this becomes a
    // POST on every render.
    localStorage.setItem('tec_campaign_tapped', JSON.stringify(['connection']));
    vi.stubGlobal('fetch', answer({ ...ME_BODY, done: [], missing: ['connection', 'zone'] }));
    const { rerender } = render(<CampaignPage />);
    await waitFor(() => expect(opens().length).toBe(1));
    rerender(<CampaignPage />);
    rerender(<CampaignPage />);
    await waitFor(() => expect(opens().length).toBe(1));
  });
});
