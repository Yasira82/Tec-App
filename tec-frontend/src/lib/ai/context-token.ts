import { SignJWT, jwtVerify } from 'jose';

/**
 * The AI's personal context, signed by the server that assembled it.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `/api/bff/ai/context` resolves the caller's REAL state from the gateway — Life
 * goals, stated focus, Analytics activity, KYC — using the session identity
 * server-side (C-106 sovereignty: own data only, never a param).
 *
 * It then handed that object to the browser, and the browser posted it back to
 * `/api/ai/chat`, which read `body.userContext` and dropped it straight into the
 * system prompt. Every platform claim about the user made a round trip through
 * the one place that cannot be trusted. Editing one fetch body was enough to
 * tell the assistant you were KYC-verified, or to hand it goals you do not have.
 *
 * The AI cannot execute anything (C-104 §4 — decision SUPPORT, never the maker),
 * so no money moves. What it does is answer the user from premises the platform
 * never asserted, in the voice of the platform. That is the damage.
 *
 * ── The fix, and why it is a token rather than a second fetch ────────────────
 * `/api/ai/chat` runs on the EDGE runtime; the context assembly is a Node BFF
 * that fans out to three gateway endpoints. Having the chat route re-resolve
 * the context would put that fan-out on EVERY message. Instead the BFF signs
 * what it assembled, and the Edge route verifies the signature — no extra hop,
 * and the browser carries a value it cannot alter.
 *
 * Same primitive the SSO handoff already uses (HS256 over `JWT_SECRET`, jose,
 * Edge-safe via Web Crypto).
 *
 * ── Three properties, each load-bearing ─────────────────────────────────────
 *  1. SIGNED    — the browser cannot change a field.
 *  2. SUBJECT-BOUND — the token carries the `sub` it was minted for, and the
 *     chat route checks it against the session it independently verified. A
 *     token is therefore useless in anyone else's session; without this, a
 *     leaked token would be a portable identity claim.
 *  3. SHORT-LIVED — context is a snapshot. A token that outlived the state it
 *     describes would let a user pin a stale KYC or an old goal list.
 */

/** A snapshot is not a session: long enough for one conversation, not a day. */
export const CONTEXT_TTL_SECONDS = 15 * 60;

const AUDIENCE = 'tec-ai-context';
const ISSUER   = 'tec.hub';

/**
 * The fields the PLATFORM asserts about the user. Only these are signed.
 *
 * `locale` and `replyLength` are deliberately NOT here: they are the user's own
 * display choices from the assistant's settings menu, they assert nothing about
 * the user, and signing them would mean a round trip every time someone toggles
 * "short answers". The boundary is *claims vs preferences*, not *server vs
 * client* — stating it that way is what keeps the next field on the right side.
 */
export interface AiContextClaims {
  /**
   * The Pi username, read from the `tec_user` session cookie server-side — the
   * platform's standard identity source, the same one every merchant-scoped
   * route derives from.
   *
   * It was previously sent by the /ai page from client state and by nothing at
   * all on the Hub drawer (whose test mocked a BFF field the BFF never returned,
   * so the greeting was personalized in the test and generic in production).
   * Signing it makes the greeting both real and trustworthy.
   */
  username?:   string;
  kycVerified: boolean;
  goals:       { title: string; done: boolean }[];
  focus?:      string;
  activity?:   { logins?: number; payments?: number; volume?: string };
}

/** Mint a context token for ONE user. Returns null if signing is not possible. */
export async function signContext(
  claims: AiContextClaims,
  sub:    string,
  secret: string | undefined,
): Promise<string | null> {
  if (!secret || !sub) return null;   // fail-soft: no token → no personalization
  try {
    return await new SignJWT({ ctx: claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${CONTEXT_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(secret));
  } catch {
    return null;
  }
}

/**
 * Verify a context token against the session that presented it.
 *
 * Returns the claims, or **null** for every failure — expired, wrong audience,
 * bad signature, or minted for a different user. Null means "no personalization"
 * (the assistant still answers), never "trust the body instead": the caller must
 * not fall back to unsigned input, which is the whole point of this module.
 */
export async function verifyContext(
  token:  unknown,
  sub:    string,
  secret: string | undefined,
): Promise<AiContextClaims | null> {
  if (typeof token !== 'string' || !token || !secret || !sub) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer:     ISSUER,
      audience:   AUDIENCE,
    });
    // The check that makes a stolen token worthless: it is only valid inside the
    // session it was minted for, and that session was verified separately.
    if (payload.sub !== sub) return null;

    const raw = (payload as { ctx?: unknown }).ctx;
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;

    // Re-narrow on the way out. The signature proves WE wrote it, not that the
    // shape still matches — the BFF's extractors are deliberately permissive
    // because upstreams change, and a token minted by an older deploy is valid.
    return {
      username:    typeof c.username === 'string' ? c.username : undefined,
      kycVerified: c.kycVerified === true,
      goals: Array.isArray(c.goals)
        ? c.goals
            .filter((g): g is { title: string; done: boolean } =>
              !!g && typeof (g as { title?: unknown }).title === 'string')
            .map(g => ({ title: g.title, done: g.done === true }))
            .slice(0, 5)
        : [],
      focus:    typeof c.focus === 'string' ? c.focus : undefined,
      activity: c.activity && typeof c.activity === 'object'
        ? (c.activity as AiContextClaims['activity'])
        : undefined,
    };
  } catch {
    return null;
  }
}
