/**
 * How a Quest tap enters the app — and why the old way was invisible to Pi.
 *
 * ── The observation ─────────────────────────────────────────────────────────
 *
 * The same Pi payment, run two ways, produced two different verdicts in the Pi
 * Developer Portal:
 *
 *     paid from the Hub modal   →  π moved · Portal checklist step FAILED
 *     paid inside the app       →  π moved · Portal checklist step PASSED
 *
 * Pi did not credit "a transaction happened for this app". It credited "this app
 * ran the Pi SDK on its own domain and did the transaction itself". The `.pi`
 * claim threshold is the same kind of counter, so a Quest tap that arrives with
 * the Hub's referrer — and therefore lands in an app whose layout deliberately
 * never loads `pi-sdk.js` — cannot feed it.
 *
 * Source-level assertions: what is being pinned is which ATTRIBUTES the anchor
 * carries. A render test can show the right label over a link that still leaks
 * the referrer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
const page = read('app/pioneers/PioneersClient.tsx');
/** Comments stripped — these assertions are about what the code DOES. */
const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('an app link hands the app its own Pi session', () => {
  it('strips the referrer, which is the Hub-entry detector', () => {
    // Every app layout skips the Pi SDK when `document.referrer` is a Hub host
    // — and does not merely leave it un-init'd: `pi-sdk.js` is never loaded
    // (ADR-007). A plain <a> from this page set that referrer on every tap.
    expect(code).toMatch(/rel:\s*'noopener noreferrer'/);
  });

  it('opens in a new tab so the Quest page survives the trip', () => {
    // Also gives the app a FRESH sessionStorage, so a `__tec_hub_entry` flag
    // left by an earlier SSO hop in another tab cannot follow it in.
    expect(code).toMatch(/target:\s*'_blank'/);
  });

  it('carries noopener, not only noreferrer', () => {
    // Standard with `_blank`, and not optional on a page that is a list of
    // outbound links.
    expect(code).toContain('noopener');
  });

  it('applies them to the app cards, and only the external ones', () => {
    // `ext` is computed once now that the href is also marked with `q=1` — the
    // same question must decide both, or a Hub route could get one and not the
    // other.
    expect(code).toMatch(/const ext\s+= isExternal\(raw\);/);
    expect(code).toMatch(/\{\.\.\.\(ext \? APP_LINK_PROPS : \{\}\)\}/);
  });
});

describe('the link tells the app there is a Quest to go back to', () => {
  it('marks external app links with q=1', () => {
    // Pi Browser has NO TABS, so `_blank` is inert there and this page does not
    // stay open behind the visit. Back walks the SSO chain and surfaces at the
    // Hub's own landing page — so the way back has to be a forward navigation
    // the app renders, and the app only knows to render it from this marker.
    expect(code).toMatch(/u\.searchParams\.set\('q', '1'\)/);
    expect(code).toMatch(/const href\s+= ext \? withQuestMark\(raw\) : raw;/);
  });

  it('sets a fixed value rather than echoing one', () => {
    // The app matches `q === '1'`. Nothing from this page is rendered by the
    // app, and nothing should be able to become so later.
    expect(code).not.toMatch(/searchParams\.set\('q',\s*[a-zA-Z]/);
  });
});

describe('a same-origin Hub route is left alone', () => {
  it('only external links get the treatment', () => {
    // `tec` routes to `/hub` — this app. There is no foreign Pi session to
    // protect, no referrer worth stripping, and a new tab for a page you are
    // already on is just a second copy of it.
    expect(code).toMatch(/const isExternal = \(href: string\) => href\.startsWith\('http'\)/);
  });
});

describe('the page says what the tap will do', () => {
  it('tells the reader a new tab opens, in both languages', () => {
    // The behaviour changed visibly. A link that silently spawns tabs on a
    // phone reads as the page misbehaving.
    expect(page).toMatch(/opens in a new tab/);
    expect(page).toContain('يفتح في تبويب جديد');
  });
});

describe('the tick still fires', () => {
  it('records the open on the tap', () => {
    // With a same-tab jump this POST raced the navigation away from the page.
    // The new tab removes the race rather than relying on `keepalive`.
    expect(code).toMatch(/onClick=\{\(\) => markVisited\(d\.slug\)\}/);
  });
});

describe('the Quest page is what the Hub catches you with', () => {
  it('remembers itself before the visit takes the pioneer away', () => {
    // ── What the back button actually does in Pi Browser ────────────────────
    // It does not go back one entry. Leaving an app returns you to the HUB'S
    // ROOT — `hub.tecosystem.app`, no path — whatever page you were on when you
    // left. Observed on a phone: from here, back landed on the Hub's "Sign in
    // with Pi" landing, not on this Quest.
    //
    // `/hub/campaign` looked immune. It is not: it lands on the same root, and
    // the root's own `takeReturn()` forwards it onward. The recovery is the Hub
    // CATCHING you, not the browser remembering — and this page wrote nothing
    // for it to catch. One call, the same one `recordOpen` makes over there.
    expect(code).toMatch(/rememberReturn\('\/pioneers'\)/);
    expect(code).toMatch(/from '@\/lib-client\/return-to'/);
  });

  it('remembers it for a signed-out visitor too', () => {
    // Set BEFORE the eligibility guard. Somebody browsing without a session
    // accrues no progress — but stranding them is not the same as not counting
    // them, and they are the likeliest person to give up and never come back.
    const fn = code.slice(code.indexOf('const markVisited'));
    const remember = fn.indexOf("rememberReturn('/pioneers')");
    const guard    = fn.indexOf('if (!eligible) return;');
    expect(remember).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(-1);
    expect(remember).toBeLessThan(guard);
  });
});
