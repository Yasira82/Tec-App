/**
 * TEC-AUDIT-0004 — the Hub's CSP runs a script only if it carries this request's nonce.
 *
 * It was a fixed string in next.config.js with `script-src 'unsafe-inline' 'unsafe-eval'`:
 * any script that reached a page ran — on the app that holds the session and starts
 * payments. Each block below fails on that code.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NextRequest } from 'next/server';
import { buildCsp, makeNonce, enforceNoEval, NONCE_HEADER } from '@/lib/csp';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';

const directive = (csp: string, name: string): string[] =>
  (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);

describe('the policy (lib/csp.ts)', () => {
  const N = makeNonce();

  it('scripts: this nonce + strict-dynamic, never unsafe-inline', () => {
    const script = directive(buildCsp(N, { allowEval: false }), 'script-src');
    expect(script).toContain(`'nonce-${N}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('eval: only while the switch is off, or under next dev', () => {
    expect(directive(buildCsp(N, { allowEval: true }), 'script-src')).toContain("'unsafe-eval'");
    expect(directive(buildCsp(N, { allowEval: false, dev: true }), 'script-src')).toContain("'unsafe-eval'");
    expect(enforceNoEval({})).toBe(false);
    expect(enforceNoEval({ CSP_ENFORCE_NO_EVAL: '1' })).toBe(true);
    expect(enforceNoEval({ CSP_ENFORCE_NO_EVAL: 'true' })).toBe(false);   // one spelling, no guessing
  });

  it('a fresh 128-bit nonce each time, and nothing else is accepted as one', () => {
    const seen = new Set(Array.from({ length: 200 }, () => makeNonce()));
    expect(seen.size).toBe(200);
    expect(atob(N)).toHaveLength(16);
    expect(() => buildCsp("x' 'unsafe-inline", { allowEval: false })).toThrow();
  });

  it('plugins and <base> are closed; violations are reported', () => {
    const csp = buildCsp(N, { allowEval: false });
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'report-uri')).toEqual(['/api/csp-report']);
  });
});

describe('the middleware sends it', () => {
  const run = async (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => {
    const { middleware } = await import('@/middleware');
    return middleware(new NextRequest(url, init));
  };

  it('a page: the policy with a nonce, to the browser and to Next.js', async () => {
    const res = await run('https://hub.tecosystem.app/hub');
    const csp = res.headers.get('content-security-policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
    // Next.js reads the request's copy to stamp its own scripts; the layout reads x-nonce.
    expect(res.headers.get(`x-middleware-request-${NONCE_HEADER}`)).toBe(nonce);
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('beside it, a report-only twin that refuses eval', async () => {
    const res = await run('https://hub.tecosystem.app/hub');
    const ro = res.headers.get('content-security-policy-report-only') ?? '';
    expect(directive(ro, 'script-src')).toContain("'strict-dynamic'");   // it is there at all
    expect(directive(ro, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(ro, 'script-src')).not.toContain("'unsafe-inline'");
  });

  it('a new nonce per request', async () => {
    const a = (await run('https://hub.tecosystem.app/')).headers.get('content-security-policy');
    const b = (await run('https://hub.tecosystem.app/')).headers.get('content-security-policy');
    expect(a).not.toBe(b);
  });

  it('the redirect and the CSRF refusal carry it too', async () => {
    const redirect = await run('https://hub.tecosystem.app/dashboard');
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get('content-security-policy')).toMatch(/'nonce-/);
    const refused = await run('https://hub.tecosystem.app/api/wallet/x', { method: 'POST' });
    expect(refused.status).toBe(403);
    expect(refused.headers.get('content-security-policy')).toMatch(/'nonce-/);
  });
});

describe('every script the Hub writes carries the nonce', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.(test|spec)\./.test(n) ? [p] : [];
  });
  // An executable <script> / <Script> tag: not a JSON-LD data block (never run).
  const TAG = /<(script|Script)\b([^>]*)>/g;

  it('the search finds an un-nonced script and passes a nonced one (self-check)', () => {
    const bad = '<script dangerouslySetInnerHTML={{ __html: X }} />';
    expect([...bad.matchAll(TAG)].some((m) => !/nonce/.test(m[2]))).toBe(true);
    expect([...'<script nonce={nonce} src="a" />'.matchAll(TAG)].some((m) => !/nonce/.test(m[2]))).toBe(false);
  });

  it('none without one', () => {
    const missing = files(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(TAG)]
        .filter((m) => !/nonce/.test(m[2]) && !/application\/ld\+json/.test(m[2]))
        .map((m) => `${relative(process.cwd(), f)}: ${m[0].slice(0, 60)}`));
    expect(missing).toEqual([]);
  });
});

describe('the sign-in landing page (api/auth/sso-callback)', () => {
  const req = (nonce: string | null) => {
    const params = new URLSearchParams({ token: 'valid-sso-tok', redirect: '/hub' });
    return {
      cookies: { get: () => undefined },
      headers: { get: (n: string) => (n === NONCE_HEADER ? nonce : null) },
      method:  'GET',
      url:     `http://localhost/api/auth/sso-callback?${params}`,
      nextUrl: { pathname: '/api/auth/sso-callback', searchParams: params, origin: 'http://localhost' },
    } as unknown as NextRequest;
  };
  const signIn = async (nonce: string | null) => {
    process.env.SSO_SECRET = 'sso-secret-test-32-chars-for-vitest';
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { jti: `jti-${Math.random()}`, accessToken: 'a', user: { id: 'u1', piUsername: 'p' } },
    } as never);
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    return (await GET(req(nonce))).text();
  };

  it("its script carries the request's nonce — it is what finishes the sign-in", async () => {
    const n = makeNonce();
    expect(await signIn(n)).toContain(`<script nonce="${n}">`);
  });

  it('a value that is not base64 never reaches the attribute', async () => {
    const html = await signIn('"><img src=x onerror=alert(1)>');
    expect(html).toContain('<script>');
    expect(html).not.toContain('onerror');
  });
});

describe('the report sink (api/csp-report)', () => {
  const post = async (body: string) => {
    const { POST } = await import('@/app/api/csp-report/route');
    return POST(new NextRequest('https://hub.tecosystem.app/api/csp-report', { method: 'POST', body }));
  };

  it('logs the rule and where — never a query string or the script sample', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post(JSON.stringify({ 'csp-report': {
      'document-uri': 'https://hub.tecosystem.app/api/auth/sso-callback?token=SECRET-ONE-TIME',
      'effective-directive': 'script-src-elem', 'blocked-uri': 'eval', disposition: 'report',
      'script-sample': 'var cookies = [{"value":"SESSION"}]',
    } }));
    expect(res.status).toBe(204);
    const line = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(line).toContain('csp.violation');
    expect(line).toContain('report-only');
    expect(line).toContain('https://hub.tecosystem.app/api/auth/sso-callback');
    expect(line).not.toContain('SECRET-ONE-TIME');
    expect(line).not.toContain('SESSION');
    warn.mockRestore();
  });

  it('junk and oversize bodies: the same empty 204, nothing logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const b of ['not json', '{}', 'x'.repeat(20_000)]) expect((await post(b)).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
