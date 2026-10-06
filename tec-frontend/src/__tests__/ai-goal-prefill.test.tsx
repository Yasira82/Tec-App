/**
 * A3 — the assistant proposes a goal; Life's own form confirms it
 * (C-104 §10.1 · Tec-App #288; the Life half is Tec-Life #76).
 *
 * Pinned: the marker grammar takes an optional query; only whitelisted keys
 * survive (renamed to the app's own), each checked; a `life:goal` chip with no
 * usable title is not rendered at all; any other action with a query is the
 * plain action; the chip is signed, opens in a new tab with no referrer, and
 * remembers where the person stood; the prompt forbids inventing values and
 * claiming the goal was created.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNavIntents, prefillQuery, NAV_TARGETS } from '@/lib/ai/nav-intents';
import { NavChip } from '@/components/ai/NavChips';

const LIFE = NAV_TARGETS.life?.href ?? '';
const origin = (() => { try { return new URL(LIFE).origin; } catch { return ''; } })();

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('prefillQuery — the whitelist', () => {
  it('title → goal, target → target; anything else dropped', () => {
    expect(prefillQuery('life:goal', 'title=Save%2050%20%CF%80&target=50&owner=bob&status=DONE'))
      .toBe('goal=Save+50+%CF%80&target=50');
  });

  it('a bad target is dropped; the title still goes', () => {
    for (const bad of ['0', '-1', 'fifty', '1e3', '1,5']) {
      expect(prefillQuery('life:goal', `title=Save&target=${encodeURIComponent(bad)}`)).toBe('goal=Save');
    }
  });

  it('the title is collapsed and capped at 80', () => {
    expect(prefillQuery('life:goal', 'title=a%0A%0Ab')).toBe('goal=a+b');
    expect(new URLSearchParams(prefillQuery('life:goal', `title=${'x'.repeat(200)}`)).get('goal')).toHaveLength(80);
  });

  it('no usable title voids the pre-fill — a target alone is no proposal', () => {
    expect(prefillQuery('life:goal', 'target=50')).toBe('');
    expect(prefillQuery('life:goal', 'title=%20&target=50')).toBe('');
  });

  it('an action with no whitelist carries nothing', () => {
    expect(prefillQuery('ecommerce:shop', 'q=phone')).toBe('');
    expect(prefillQuery('life:goal', undefined)).toBe('');
  });
});

describe('parseNavIntents — the query in the marker', () => {
  it('[[go:life:goal?title=…]] → a signed chip to Life\'s /app with the goal pre-filled, the marker gone from the prose', () => {
    const r = parseNavIntents('You can add it in Life. [[go:life:goal?title=Save%2050%20%CF%80&target=50]]');
    expect(r.clean).toBe('You can add it in Life.');
    expect(r.intents).toHaveLength(1);
    const it0 = r.intents[0]!;
    expect(it0.slug).toBe('life');
    expect(it0.action).toBe('goal');
    expect(it0.signed).toBe(true);
    expect(it0.href).toBe(`${origin}/app?goal=Save+50+%CF%80&target=50`);
  });

  it('a label after the query still works', () => {
    const r = parseNavIntents('[[go:life:goal?title=Learn%20Rust|Add it]]');
    expect(r.intents[0]?.label).toBe('Add it');
    expect(r.intents[0]?.href).toBe(`${origin}/app?goal=Learn+Rust`);
  });

  it('a life:goal with no usable title renders no chip — never an empty form under a promising label', () => {
    for (const m of ['[[go:life:goal]]', '[[go:life:goal?target=50]]', '[[go:life:goal?title=%20]]']) {
      expect(parseNavIntents(m).intents).toEqual([]);
    }
  });

  it('a query on an action with no whitelist is ignored — the plain action, unsigned', () => {
    const r = parseNavIntents('[[go:ecommerce:shop?q=phone&redirect=https://evil.example]]');
    expect(r.intents[0]?.href).toMatch(/\/shop$/);
    expect(r.intents[0]?.signed).toBeUndefined();
  });

  it('existing markers are unchanged', () => {
    expect(parseNavIntents('[[go:tec:pay]]').intents[0]?.href).toBe('/hub?pay=1');
    expect(parseNavIntents('[[go:life]]').intents[0]?.signed).toBeUndefined();
  });
});

describe('NavChip — a signed chip goes through the handoff', () => {
  const intent = parseNavIntents('[[go:life:goal?title=Save&target=10]]').intents[0]!;

  it('asks for the signed link, opens it in a new tab with no referrer, and remembers where the person stood', async () => {
    const signedUrl = `${origin}/api/auth/sso-callback?token=abc&redirect=%2Fapp%3Fgoal%3DSave%26target%3D10`;
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ links: { [intent.href]: signedUrl } }) }) as Response);
    vi.stubGlobal('fetch', f);
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/ai');
    render(<NavChip intent={intent} />);
    const a = screen.getByRole('link') as HTMLAnchorElement;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('data-signed')).toBe('true');
    await waitFor(() => expect(a.getAttribute('href')).toBe(signedUrl));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/sso-links');
    expect(JSON.parse(String(init.body))).toEqual({ targets: [intent.href] });
    fireEvent.click(a);
    expect(a.getAttribute('href')).toBe(signedUrl); // never changed inside its own click (C-123 §12)
  });

  it('when no signed link can be had, the plain link is the fallback — never a dead end', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ links: {} }) }) as Response));
    render(<NavChip intent={intent} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('link').getAttribute('href')).toBe(intent.href);
  });

  it('an ordinary chip asks for nothing', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<NavChip intent={parseNavIntents('[[go:tec:pay]]').intents[0]!} />);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('the prompt', () => {
  const prompt = readFileSync(join(process.cwd(), 'src/lib/ai/tec-ai-system-prompt.ts'), 'utf8');

  it('offers the chip only for a goal in the person\'s own words, and never claims it was created', () => {
    expect(prompt).toContain('[[go:life:goal?title=<their words>&target=<amount>]]');
    expect(prompt).toMatch(/Never invent a goal, a title or an amount they did not say/);
    expect(prompt).toMatch(/never claim the goal was created/);
    expect(prompt).toMatch(/Life saves NOTHING until they tap Add/);
  });
});
