/**
 * Feedback — the submit path, and the one header the admin route must not send.
 *
 * The inbox is only useful if a person can read it, and only SAFE if the wrong
 * person cannot. Both halves are asserted here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, waitFor } from '@/test-utils/render-with-locale';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

/**
 * The file with its comments removed.
 *
 * The header assertions below are about what the route SENDS, and the route
 * explains at length why it does not send `x-internal-key` — so a plain text
 * match fails on the explanation. Grepping prose would make "delete the
 * comment" a way to pass, which is the opposite of what this pins.
 */
const codeOf = (p: string) =>
  src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── The header that must never be sent ──────────────────────────────────────

describe('the admin route forwards the user, not a service credential', () => {
  const route = codeOf('app/api/admin/feedback/route.ts');

  it('never attaches x-internal-key', () => {
    // This is the whole security argument. identity-service treats that header
    // as a ServiceActor credential and SKIPS the role check, so sending it here
    // would let any signed-in visitor who found the URL read everyone's
    // messages (Forbidden Behavior #7). Every other admin-ish route in this app
    // attaches it, which is exactly why this needs pinning rather than trusting.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('sends the session token and nothing else as authority', () => {
    expect(route).toContain('tec_access_token');
    expect(route).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });

  it('refuses with 401 before calling the gateway when there is no token', () => {
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('passes the service’s status through instead of flattening it', () => {
    // A 403 from the service has to REACH the page, or the screen cannot tell
    // "you may not" apart from "nothing here".
    expect(route).toMatch(/status: res\.status/);
  });

  it('forwards only the filters the service understands', () => {
    // An open query passthrough turns a BFF into a way to reach parameters it
    // was never meant to expose.
    expect(route).toMatch(/\['status', 'app', 'limit'\]/);
  });
});

// ── The user-facing route ───────────────────────────────────────────────────

describe('the submit route labels the app itself', () => {
  const route = codeOf('app/api/bff/feedback/route.ts');

  it('spreads the parsed body FIRST so app cannot be overridden', () => {
    // A label anyone can set is a label nobody can sort by.
    expect(route).toMatch(/\{ \.\.\.input, app: APP \}/);
  });

  it('does not accept an app field from the request', () => {
    expect(route).not.toMatch(/app:\s*z\./);
  });

  it('carries the service’s own error sentence', () => {
    // The hourly rate limit is a rule the client cannot see; a generic failure
    // there hides the only useful line.
    expect(route).toMatch(/data\?\.message \?\? data\?\.error/);
  });
});

// ── The form ────────────────────────────────────────────────────────────────

describe('the form never refuses in silence', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('the send button is not disabled on invalid input', () => {
    render(<FeedbackCard />);
    const btn = screen.getByRole('button', { name: en.feedback.send });
    expect(btn).not.toBeDisabled();
  });

  it('an empty submit explains, and sends nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<FeedbackCard />);
    fireEvent.click(screen.getByRole('button', { name: en.feedback.send }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.feedback.tooShort));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the SERVER’s message when the send is refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Too many messages this hour' } }), { status: 429 }),
    );
    render(<FeedbackCard />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'the wallet card is cut off' } });
    fireEvent.click(screen.getByRole('button', { name: en.feedback.send }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Too many messages this hour'),
    );
  });

  it('sends the message and the page, and thanks the person', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'f1' }), { status: 200 }),
    );
    render(<FeedbackCard page="/hub/profile" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  the band is too tall  ' } });
    fireEvent.click(screen.getByRole('button', { name: en.feedback.send }));

    await waitFor(() => expect(screen.getByText(en.feedback.thanks)).toBeInTheDocument());
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    // Trimmed — trailing whitespace is not part of what they said.
    expect(body).toEqual({ message: 'the band is too tall', page: '/hub/profile' });
  });

  it('says what is attached before they type', () => {
    render(<FeedbackCard />);
    expect(screen.getByText(en.feedback.privacyNote)).toBeInTheDocument();
  });
});

describe('the marks and copy survive both languages', () => {
  it('every feedback key exists in Arabic too', () => {
    // The parity test covers the whole tree; this one names the section, so a
    // failure points at feedback rather than at "some key somewhere".
    expect(Object.keys(ar.feedback).sort()).toEqual(Object.keys(en.feedback).sort());
  });

  it('the Arabic length error keeps its {n} placeholder', () => {
    // Without it the number silently disappears from the sentence that exists
    // to report a number.
    expect(ar.feedback.tooLong).toContain('{n}');
  });
});
