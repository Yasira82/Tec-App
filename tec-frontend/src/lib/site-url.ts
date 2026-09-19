/**
 * The Hub's public origin — one definition, used by everything that prints a URL.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * There were three copies of this constant, with TWO different fallbacks:
 *
 *   app/layout.tsx   → 'https://tec-app-frontend.vercel.app'   (metadataBase)
 *   app/sitemap.ts   → 'https://tec-app.vercel.app'
 *   app/robots.ts    → 'https://tec-app.vercel.app'
 *
 * So with `NEXT_PUBLIC_APP_URL` unset at build time, every page's canonical URL
 * and the sitemap listing that page named **different hosts** — and neither was
 * the Hub. A search engine handed two origins for one site does not average
 * them; it picks, and the campaign's Open Graph card and FAQ structured data
 * ride on whichever it picked.
 *
 * `NEXT_PUBLIC_*` is inlined at BUILD time, so an env that is right in the
 * dashboard but was not set when the build ran is still wrong in the bundle,
 * and nothing warns. That is the `C_HUB_URL` shape the template's CLAUDE.md
 * already records — a placeholder that became a live redirect target and 404'd
 * (July 2026 System incident).
 *
 * The fallback is now the real domain, because that is a fact about this
 * deployment and not a guess: a Hub that cannot read its env is still the Hub.
 * A preview host in a canonical tag is a worse failure than a canonical that
 * points at production from a preview.
 */

const DEFAULT_ORIGIN = 'https://hub.tecosystem.app';

/** Accepts only a real http(s) origin — a placeholder must never become a URL. */
function sanitize(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  if (!/^https?:\/\//i.test(v)) return DEFAULT_ORIGIN;
  try {
    return new URL(v).origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export const SITE_URL = sanitize(process.env.NEXT_PUBLIC_APP_URL);
