import { createHandler } from '@/lib/bff/createHandler';
import { signContext }   from '@/lib/ai/context-token';
import { lifeContextToAi, type SkillLevel } from '@/lib/ai/life-context';

/**
 * TEC AI — personalization context (C-104 reasoning input · C-121 pipeline).
 *
 * Assembles a COMPACT, OWN-SCOPE snapshot of the caller's real state so the
 * assistant can reason from the user's actual context instead of a generic reply:
 *   - kycVerified  — from the verified session (free, no network call)
 *   - goals/focus  — the user's OWN Life goals + focus (C-106, self-declared)
 *   - activity     — the user's OWN recent Analytics overview (C-105, eventual)
 *
 * PRIVACY (C-106 sovereignty / P6): every field is the caller's OWN data, derived
 * from the session identity server-side — never a param or body. Each upstream is
 * FAIL-SOFT: a missing/slow/erroring source is simply omitted, never blocks the
 * assistant (which still works on base context). No cross-user data ever leaves here.
 *
 * The AI is a GUIDE, not an executor (C-104 §1.5): this is read-only context to
 * inform suggestions — it moves nothing.
 */

const TIMEOUT_MS = 2500;

async function getJson(url: string, token: string, requestId: string, extra: Record<string, string> = {}): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-request-id':  requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        ...extra,
      },
      cache:  'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null; // fail-soft — omit this source
  }
}

/** Like getJson, but says WHY nothing came back — the "what TEC AI sees" line needs it. */
async function getJsonStatus(url: string, token: string, requestId: string, extra: Record<string, string> = {}): Promise<{ status: number | null; body: unknown | null }> {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-request-id':  requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        ...extra,
      },
      cache:  'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { status: res.status, body: res.ok ? await res.json().catch(() => null) : null };
  } catch {
    return { status: null, body: null };
  }
}

/**
 * What the assistant was actually given from Life — shown to the person in the
 * assistant's Settings ("what TEC AI can see now"). The second reading had "can you
 * see my goals in Life?" with no way for anyone to tell whether the answer was a
 * consent switch, an empty list, or a read that failed. This says which.
 *
 * NOT signed and never read by the chat route: it describes the person's own data to
 * the person, and asserts nothing to the model.
 */
export interface AiSeen {
  /** read · no Life profile (404) · the read failed · no username/gateway to ask with */
  life:    'read' | 'no_profile' | 'unavailable' | 'not_asked';
  consent: Record<string, boolean>;
  goals:   number;
  skills:  number | null;
  pace:    boolean;
}

// Narrow, defensive extractors — backends evolve; never throw on a shape change.
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export interface AiContext {
  /** Pi username, from the `tec_user` session cookie — never from the client. */
  username?:   string;
  kycVerified: boolean;
  goals:       { title: string; done: boolean }[];
  focus?:      string;
  activity?:   { logins?: number; payments?: number; volume?: string };
  /** A1 — what Life's door served when SKILLS / TRAJECTORY are granted (lib/ai/life-context.ts). */
  skills?:     { name: string; level: SkillLevel }[];
  pace?:       { pi_per_week: number; active_days: number };
  /**
   * The same context, SIGNED for this caller — the only form `/api/ai/chat`
   * will accept (see lib/ai/context-token.ts).
   *
   * The plain fields above stay in the response because the UI reads them; the
   * chat route ignores them entirely. It used to trust them, which meant every
   * platform claim about the user travelled through the browser and could be
   * rewritten there. Null when signing is unavailable — the assistant then
   * answers without personalization rather than on unverified input (P6).
   */
  contextToken?: string;
  seen?: AiSeen;
}

export const GET = createHandler<Record<string, never>, AiContext>({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const gateway = process.env.API_GATEWAY_URL ?? '';
    const token   = req.cookies.get('tec_access_token')?.value ?? '';

    // Signed on the way out, at EVERY return — including the fail-soft one below.
    // `kycVerified` alone is still a platform claim, so the degraded path needs
    // the signature just as much as the full one.
    const sealed = async (c: AiContext): Promise<AiContext> => ({
      ...c,
      contextToken: (await signContext(
        {
          username:    c.username,
          kycVerified: c.kycVerified,
          goals:       c.goals,
          focus:       c.focus,
          activity:    c.activity,
          skills:      c.skills,
          pace:        c.pace,
        },
        ctx.userId,
        process.env.JWT_SECRET,
      )) ?? undefined,
    });

    // Identity from the session cookie, server-side — the platform's standard
    // source (CLAUDE.md: identity ALWAYS from `tec_user`, never the body). Kept
    // defensive: a malformed cookie means no username, never a 500.
    let username: string | undefined;
    try {
      const rawUser = req.cookies.get('tec_user')?.value;
      const parsed  = rawUser ? JSON.parse(decodeURIComponent(rawUser)) : null;
      username = str((parsed as { piUsername?: unknown; username?: unknown })?.piUsername)
              ?? str((parsed as { username?: unknown })?.username);
    } catch { /* no username — the assistant greets generically */ }

    const out: AiContext = { username, kycVerified: ctx.kycVerified, goals: [] };
    const notAsked: AiSeen = { life: 'not_asked', consent: {}, goals: 0, skills: null, pace: false };
    if (!gateway || !token) return { ...(await sealed(out)), seen: notAsked }; // fail-soft: base context only

    // Life is read through its CONSENT-GATED door only (lib/ai/life-context.ts):
    // what the person switched off on Life's Privacy screen never reaches the
    // prompt. The reader names itself — Life audits every read with it.
    const [lifeRes, overviewRaw] = await Promise.all([
      username
        ? getJsonStatus(`${gateway}/api/identity/life/context/${encodeURIComponent(username)}`, token, ctx.requestId, { 'x-service-name': 'tec-app-ai' })
        : Promise.resolve(null),
      getJson(`${gateway}/api/analytics/me/overview`, token, ctx.requestId),
    ]);
    const lifeRaw = lifeRes?.body ?? null;
    const life = lifeContextToAi(lifeRaw);
    const seen: AiSeen = {
      life: !lifeRes ? 'not_asked'
        : lifeRes.body ? 'read'
        : lifeRes.status === 404 ? 'no_profile'
        : 'unavailable',
      consent: life.consent,
      goals:   life.goals.length,
      skills:  life.skills ? life.skills.length : null,
      pace:    !!life.pace,
    };
    out.goals = life.goals;
    out.focus = life.focus;
    // Served only when granted — and then only the ladder word and the pace,
    // never a score, never the entry log (C-106 §11b: the door serves a pace).
    if (life.skills) out.skills = life.skills;
    if (life.pace)   out.pace   = life.pace;

    // Activity — own aggregates only (never presented to the AI as financial truth).
    const ov = (overviewRaw as { data?: Record<string, unknown> })?.data ?? (overviewRaw as Record<string, unknown>) ?? {};
    const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const activity = {
      logins:   num(ov.logins) ?? num(ov.loginCount),
      payments: num(ov.payments) ?? num(ov.paymentCount),
      volume:   str(ov.volume) ?? str(ov.totalVolume),
    };
    if (activity.logins !== undefined || activity.payments !== undefined || activity.volume !== undefined) {
      out.activity = activity;
    }

    return { ...(await sealed(out)), seen };
  },
});
