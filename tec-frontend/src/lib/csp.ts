// ─────────────────────────────────────────────────────────────────────────────
// The Hub's Content-Security-Policy — the ONE place it is written (TEC-AUDIT-0004).
//
// It used to be a fixed string in next.config.js with `script-src 'unsafe-inline'
// 'unsafe-eval'`: any script that got into a page — through any XSS — ran, on the
// app that holds the session and starts payments. A fixed string cannot do better,
// because Next.js writes inline scripts of its own on every page.
//
// So the middleware makes a fresh nonce per request and sends this policy with it:
//   · `'nonce-…'`       — a script runs only if it carries this request's nonce.
//                          Next.js reads the nonce from the request's CSP header and
//                          stamps it on its own scripts and on next/script tags; our two boot
//                          scripts (layout.tsx) and the sign-in landing page
//                          (api/auth/sso-callback) stamp it themselves.
//   · `'strict-dynamic'` — a script the nonce'd ones load (the Pi SDK, Next's
//                          chunks) is trusted too; nothing else is. Browsers that
//                          understand it ignore the host list and 'unsafe-inline'.
//   · no `'unsafe-inline'`.
//
// `'unsafe-eval'` is the one part not proven here: the Pi SDK is served from
// sdk.minepi.com and cannot be read from where this was written, so whether it calls
// eval is unknown — and if it does, removing it would break sign-in for everyone.
// The enforced policy therefore keeps it for now, and a REPORT-ONLY policy without
// it runs beside it: every eval the Hub would have blocked is reported to
// /api/csp-report and logged. When a Pi Browser sign-in and a Mode-2 payment
// produce no such report, set CSP_ENFORCE_NO_EVAL=1 on Vercel and redeploy (the
// middleware may read its env at build time), and eval is refused for real.
// Unsetting it and redeploying is the way back.
//
// The enforced policy reports too: a script it blocks (a nonce this file forgot)
// shows up in the same log instead of failing silently in someone's phone.
// ─────────────────────────────────────────────────────────────────────────────

export const NONCE_HEADER = 'x-nonce';
export const CSP_REPORT_PATH = '/api/csp-report';

/** 128 bits from the platform RNG, base64 — the middleware runs on the edge (no Buffer). */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

interface Options {
  /** `next dev` evaluates modules with eval; production does not. */
  dev?: boolean;
  /** Keep 'unsafe-eval' in the script-src (see the header above). */
  allowEval: boolean;
  /** connect-src as the named list instead of `'self' https: wss:` (see connect-src below). */
  namedConnect?: boolean;
}

export function buildCsp(nonce: string, { dev = false, allowEval, namedConnect = false }: Options): string {
  if (!/^[A-Za-z0-9+/=]{16,}$/.test(nonce)) throw new Error('buildCsp: not a nonce');

  const script = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(allowEval || dev ? ["'unsafe-eval'"] : []),
    // Read only by browsers without CSP3 (no 'strict-dynamic'); ignored by the rest.
    'https://sdk.minepi.com https://*.minepi.com',
  ].join(' ');

  const directives = [
    "default-src 'self'",
    script,
    // connect-src (src/__tests__/csp-connect-src.test.ts). The named list below was
    // ENFORCED on 11 Nov 2026 (#324) and broke Pi sign-in in Pi Browser on 15 Nov:
    // the Pi SDK reaches a host it does not name, and which one cannot be read from
    // here. Rolling back to `'self' https: wss:` fixed it. So that is what is
    // enforced, and the named list runs in the REPORT-ONLY policy: what it would
    // block is reported, never blocked. CSP_ENFORCE_NAMED_CONNECT=1 enforces it once
    // a sign-in and a payment report nothing. Server-side calls are not limited by CSP.
    namedConnect ? [
      "connect-src 'self'",
      'https://*.minepi.com https://minepi.com wss://*.minepi.com',            // Pi SDK
      'https://*.up.railway.app wss://*.up.railway.app',                      // realtime (Railway domain; socket.io polls before it upgrades)
      'https://*.tecosystem.app wss://*.tecosystem.app',                      // realtime on a custom domain; sibling apps
      'https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io', // Sentry
      ...(dev ? ['ws://localhost:* http://localhost:*'] : []),                // next dev's reload socket
    ].join(' ') : "connect-src 'self' https: wss:" + (dev ? ' ws://localhost:* http://localhost:*' : ''),
    // *.r2.dev hosts the NFT artwork uploaded through tec-assets. Without it
    // the browser BLOCKS every NFT image on /dashboard/assets and the tile
    // renders empty. tec-assets already allows it — the Hub was the outlier.
    "img-src 'self' data: blob: *.railway.app *.vercel.app *.r2.dev",
    // Inline STYLE stays: React's style={} props are style attributes, which a
    // nonce cannot cover. Styles cannot run code; scripts were the hole.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src 'self' sdk.minepi.com *.minepi.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self' *.minepi.com minepi.com",
    "object-src 'none'",
    "base-uri 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
  ];
  return directives.join('; ');
}

/** Whether the enforced connect-src is the named list — off until it is proven in Pi Browser. */
export function enforceNamedConnect(env: Record<string, string | undefined> = process.env): boolean {
  return env.CSP_ENFORCE_NAMED_CONNECT === '1';
}

/** Whether the enforced policy refuses eval — the switch described above. */
export function enforceNoEval(env: Record<string, string | undefined> = process.env): boolean {
  return env.CSP_ENFORCE_NO_EVAL === '1';
}
