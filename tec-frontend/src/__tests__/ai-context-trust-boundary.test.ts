// @vitest-environment node
//
// The AI's picture of the user is a PLATFORM CLAIM, and it travelled through the
// browser.
//
// `/api/bff/ai/context` resolves the caller's real state from the gateway — Life
// goals, stated focus, Analytics activity, KYC — server-side, from the session
// identity, exactly as C-106 sovereignty requires. It then returned that object
// to the browser, and the browser posted it back to `/api/ai/chat`, which read
// `body.userContext` whole, unvalidated, and dropped it into the system prompt.
//
// Editing one fetch body was enough to tell the assistant you were KYC-verified,
// or to hand it goals you do not have. Two call sites did it — the drawer hook
// and the /ai page — and the page also sent a client-read `username`.
//
// Nothing executes on these: the AI guides, it never acts (C-104 §4). No money
// moves. It answers the user from premises the platform never asserted, in the
// platform's voice — which is the whole reason anyone would trust the answer.
//
// The fix is a token this server signs for ONE `sub`, short-lived, verified on
// the Edge route. The split it encodes is *claims vs preferences*, not *server
// vs client*: the reply language and length are the user's own choices, assert
// nothing, and stay in the body.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import { signContext, verifyContext, CONTEXT_TTL_SECONDS } from '@/lib/ai/context-token';

const SECRET = 'test-secret-value-long-enough-for-hs256';
const CLAIMS = {
  kycVerified: true,
  goals: [{ title: 'Save 100 π', done: false }],
  focus: 'saving',
  activity: { logins: 3, payments: 1, volume: '12.5' },
};

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('a context token is only valid for the session it was minted for', () => {
  it('round-trips the claims for the right user', async () => {
    const token = await signContext(CLAIMS, 'user-1', SECRET);
    expect(token).toBeTruthy();
    expect(await verifyContext(token, 'user-1', SECRET)).toEqual(CLAIMS);
  });

  it('REFUSES a token minted for someone else', async () => {
    // The property that makes a leaked token worthless. Without the `sub` check
    // a token would be a portable identity claim: lift it from one session,
    // present it in another, and the assistant adopts the first user's context.
    const token = await signContext(CLAIMS, 'user-1', SECRET);
    expect(await verifyContext(token, 'user-2', SECRET)).toBeNull();
  });

  it('refuses a token signed with a different secret', async () => {
    const token = await signContext(CLAIMS, 'user-1', 'some-other-secret-entirely');
    expect(await verifyContext(token, 'user-1', SECRET)).toBeNull();
  });

  it('refuses an expired token — context is a snapshot, not a session', async () => {
    // Without expiry a user could pin a KYC status or a goal list indefinitely.
    const stale = await new SignJWT({ ctx: CLAIMS })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1').setIssuer('tec.hub').setAudience('tec-ai-context')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyContext(stale, 'user-1', SECRET)).toBeNull();
  });

  it('refuses a token minted for a different audience', async () => {
    // The session cookie is signed with this same JWT_SECRET. Without an
    // audience check an access token would verify here and its payload would be
    // read as context.
    const wrongAud = await new SignJWT({ ctx: CLAIMS })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1').setIssuer('tec.hub').setAudience('something-else')
      .setIssuedAt().setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyContext(wrongAud, 'user-1', SECRET)).toBeNull();
  });

  it('fails CLOSED on every malformed input', async () => {
    for (const bad of [undefined, null, '', 'not-a-jwt', 42, {}, { kycVerified: true }]) {
      expect(await verifyContext(bad, 'user-1', SECRET)).toBeNull();
    }
  });

  it('returns null rather than throwing when signing is impossible', async () => {
    // No JWT_SECRET must degrade to "no personalization", never to an error that
    // takes the assistant down, and never to trusting the body instead.
    expect(await signContext(CLAIMS, 'user-1', undefined)).toBeNull();
    expect(await signContext(CLAIMS, '', SECRET)).toBeNull();
  });

  it('re-narrows the payload on the way out', async () => {
    // The signature proves WE wrote it — not that the shape still matches. The
    // BFF's extractors are deliberately permissive because upstreams change, and
    // a token minted by an older deploy stays valid for its lifetime.
    const loose = await new SignJWT({ ctx: { kycVerified: 'yes', goals: 'nope', focus: 7 } })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1').setIssuer('tec.hub').setAudience('tec-ai-context')
      .setIssuedAt().setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyContext(loose, 'user-1', SECRET))
      .toEqual({ kycVerified: false, goals: [], focus: undefined, activity: undefined });
  });

  it('keeps the lifetime short', () => {
    expect(CONTEXT_TTL_SECONDS).toBeLessThanOrEqual(30 * 60);
  });
});

describe('the chat route reads claims from the token, never from the body', () => {
  const route = read('src/app/api/ai/chat/route.ts');

  it('verifies the token against the AUTHENTICATED user', () => {
    // `userId` is the `sub` this route verified itself from the session cookie —
    // not a value from the body. Passing anything else would re-open the hole.
    expect(route).toMatch(/verifyContext\(\s*body\.contextToken,\s*userId,/);
  });

  it('does NOT pass the body through to the prompt', () => {
    // The defect, in one line: `const userContext = body.userContext`.
    expect(route).not.toMatch(/userContext\s*(:[^=]*)?=\s*body\.userContext\s*;/);
    expect(route).not.toMatch(/\.\.\.\s*raw\b/);   // no blanket spread either
  });

  it('has no fallback to unsigned input when verification fails', () => {
    // Failing closed means a less personal answer. Falling open means the prompt
    // states things nobody checked — which is the bug (P6).
    expect(route).toMatch(/\.\.\.\(claims \?\? \{\}\)/);
    expect(route).not.toMatch(/claims \?\? .*body/);
  });

  it('narrows preferences against a closed set', () => {
    expect(route).toMatch(/oneOf\(raw\.locale,\s*\['en', 'ar'\]/);
    expect(route).toMatch(/oneOf\(raw\.replyLength,\s*\['short', 'detailed'\]/);
  });
});

describe('BOTH call sites send the token, and neither sends claims', () => {
  // The /ai page was a second, separate copy of the same body. A fix applied to
  // only the drawer would have left the page wide open — and the page was the
  // worse of the two, because it also sent a client-read `username`.
  const sites = {
    'useAiChat.ts':  read('src/lib-client/hooks/useAiChat.ts'),
    'AiClient.tsx':  read('src/app/ai/AiClient.tsx'),
  };

  it.each(Object.entries(sites))('%s sends contextToken', (_name, src) => {
    expect(src).toMatch(/contextToken:/);
  });

  it.each(Object.entries(sites))('%s no longer spreads the context into the body', (_name, src) => {
    expect(src).not.toMatch(/\.\.\.\(\s*(ctx|aiCtx)\s*\?\?\s*\{\}\s*\)/);
  });

  it('the /ai page no longer asserts a username read from client state', () => {
    expect(sites['AiClient.tsx']).not.toMatch(/username:\s*user\?\.piUsername/);
  });
});

describe('the BFF signs every path it returns', () => {
  const bff = read('src/app/api/bff/ai/context/route.ts');

  it('signs for the session user, not a body value', () => {
    // The subject binding is the property that makes the token non-portable, so
    // it has to be the SESSION identity. `ctx.userId` is the verified `sub` from
    // createHandler; anything read from the request body would defeat it.
    expect(bff).toMatch(/signContext\([\s\S]*?ctx\.userId/);
    expect(bff).not.toMatch(/signContext\([\s\S]*?body\./);
  });

  it('reads the username from the session cookie, never from the client', () => {
    expect(bff).toMatch(/req\.cookies\.get\('tec_user'\)/);
  });

  it('signs the DEGRADED path too', () => {
    // `kycVerified` alone is still a platform claim. The fail-soft branch — no
    // gateway, no token — returns it, so it needs the signature just as much.
    expect(bff).toMatch(/return sealed\(out\); \/\/ fail-soft/);
    expect(bff).not.toMatch(/return out;/);
  });
});
