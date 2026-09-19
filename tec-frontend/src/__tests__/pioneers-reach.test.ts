/**
 * Whether the campaign page can be found, and whether it can say the one thing
 * it exists to say.
 *
 * These are not correctness defects — nothing here computes a wrong answer.
 * They are the difference between a page that works and a campaign that works,
 * and each was invisible precisely because the code around it was fine.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const page = read('src/app/pioneers/PioneersClient.tsx');

describe('G1 — a crawler is told the campaign exists', () => {
  it('lists /pioneers and its FAQ, not only the legal pages', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = sitemap().map((e) => e.url);
    // The FAQ publishes `FAQPage` structured data so search results can surface
    // the questions. Structured data nobody crawls is work that does nothing.
    expect(urls.some((u) => u.endsWith('/pioneers'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/pioneers/faq'))).toBe(true);
  });
});

describe('G2 — one origin, and it is the Hub', () => {
  it('falls back to the real domain, never a preview host', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { SITE_URL } = await import('@/lib/site-url');
    expect(SITE_URL).toBe('https://hub.tecosystem.app');
  });

  it('refuses a placeholder that is not a URL', async () => {
    // The `C_HUB_URL` shape: a placeholder that became a live redirect target
    // and 404'd (July 2026 System incident).
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = 'C_APP_URL';
    const { SITE_URL } = await import('@/lib/site-url');
    expect(SITE_URL).toBe('https://hub.tecosystem.app');
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('the canonical, the sitemap and robots all read the same constant', async () => {
    // There were three copies with TWO different fallbacks, so an unset env made
    // every page's canonical and the sitemap listing it name different hosts.
    for (const f of ['src/app/layout.tsx', 'src/app/sitemap.ts', 'src/app/robots.ts']) {
      expect(read(f)).toMatch(/from '@\/lib\/site-url'/);
      expect(read(f)).not.toMatch(/vercel\.app/);
    }
  });
});

describe('G3 — the live counters are the owner\'s, and nobody else\'s', () => {
  it('has no public path at all', () => {
    // ── A reversal of this file's own earlier assertion ────────────────────
    // It pinned a floor of 10 claimed, above which the counters opened to
    // everyone, on the argument that scarcity is the strongest thing a
    // capped-cohort page can say.
    //
    // The argument was fine. The numbers are not scarcity: the cohort stands at
    // 6 of 100, several of them the owner's own test accounts. A cold visitor
    // reads "6 claimed, 11 joined" as an empty room, not a closing door — and a
    // counter that argues against the page it sits on is worse than none.
    //
    // The page still carries the scarcity claim in words ("only the first 100
    // qualify"), which does not need a number beside it to be true.
    expect(page).not.toMatch(/PUBLIC_COUNTER_MIN/);
    expect(page).toMatch(/const showCounters = !!serverStats && isPioneerAdmin;/);
  });
});

describe('G4 — a Founding Pioneer is pointed at the PRO they were promised', () => {
  it('links to where the subscription actually lives', () => {
    expect(page).toMatch(/href="\/hub\/subscription"/);
    expect(page).toMatch(/t\.seePro/);
  });
});

describe('G5 — the signed-out trap is named where the tapping happens', () => {
  it('warns beside the grid, not only in the gate card above it', () => {
    // Somebody can work through a dozen apps before discovering none of it was
    // kept: `markVisited` returns early when not signed in.
    expect(page).toMatch(/t\.appsSignedOut/);
    expect(page).toMatch(/\{!eligible && !authLoading && \(/);
  });

  it('says it in both languages', () => {
    expect(page).toMatch(/You are not signed in/);
    expect(page).toContain('إنت مش مسجّل دخول');
  });
});
