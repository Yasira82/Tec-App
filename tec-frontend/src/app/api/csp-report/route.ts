import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/observability';

/**
 * Where the browser reports what the Content-Security-Policy blocked — or, for the
 * report-only policy, would have blocked (src/lib/csp.ts, TEC-AUDIT-0004).
 *
 * This is how the last step is decided rather than guessed: the report-only policy
 * refuses eval, so if the Pi SDK needs eval, a sign-in in Pi Browser leaves a line
 * here before anything is switched off for real.
 *
 * What is logged is the rule and WHERE — never a query string and never the script
 * sample: the sign-in landing page's address carries a one-time token, and its
 * inline script carries the session it is setting. Anyone can post here, so the
 * body is capped and the answer is always the same empty 204.
 */
const MAX_BYTES = 16_384;

const where = (u: unknown): string | undefined => {
  if (typeof u !== 'string' || !u) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return u.slice(0, 40);          // 'inline', 'eval', 'self'
  try { const x = new URL(u); return `${x.origin}${x.pathname}`.slice(0, 200); }
  catch { return undefined; }
};

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return new NextResponse(null, { status: 204 });
    const body = JSON.parse(text) as Record<string, unknown>;
    // report-uri sends { "csp-report": {…} }; the Reporting API sends [{ body: {…} }].
    const r = (Array.isArray(body) ? (body[0] as { body?: unknown })?.body : body['csp-report']) as
      Record<string, unknown> | undefined;
    if (!r || typeof r !== 'object') return new NextResponse(null, { status: 204 });

    log.warn('csp.violation', {
      disposition: r.disposition === 'report' ? 'report-only' : String(r.disposition ?? 'enforce'),
      directive:   String(r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'] ?? '').slice(0, 60),
      blocked:     where(r['blocked-uri'] ?? r.blockedURL),
      page:        where(r['document-uri'] ?? r.documentURL),
      source:      where(r['source-file'] ?? r.sourceFile),
      line:        typeof (r['line-number'] ?? r.lineNumber) === 'number' ? (r['line-number'] ?? r.lineNumber) : undefined,
    });
  } catch {
    /* a malformed report is not worth an error — and the sender cannot act on one */
  }
  return new NextResponse(null, { status: 204 });
}
