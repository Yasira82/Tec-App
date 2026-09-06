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
      expect(hrefs).toContain('https://connection.tecosystem.app/app?invite=abc');
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
