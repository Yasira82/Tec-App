import { createHandler } from '@/lib/bff/createHandler';
import { signContext }   from '@/lib/ai/context-token';

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

async function getJson(url: string, token: string, requestId: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-request-id':  requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
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

// Narrow, defensive extractors — backends evolve; never throw on a shape change.
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : Array.isArray((v as { data?: unknown })?.data) ? (v as { data: unknown[] }).data : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export interface AiContext {
  /** Pi username, from the `tec_user` session cookie — never from the client. */
  username?:   string;
  kycVerified: boolean;
  goals:       { title: string; done: boolean }[];
  focus?:      string;
  activity?:   { logins?: number; payments?: number; volume?: string };
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
    if (!gateway || !token) return sealed(out); // fail-soft: base context only

    const [goalsRaw, prefsRaw, overviewRaw] = await Promise.all([
      getJson(`${gateway}/api/identity/life/goals`,       token, ctx.requestId),
      getJson(`${gateway}/api/identity/life/preferences`, token, ctx.requestId),
      getJson(`${gateway}/api/analytics/me/overview`,     token, ctx.requestId),
    ]);

    // Goals — keep at most 5 active/most-recent, title + done only (no ids/timestamps).
    out.goals = asArray(goalsRaw)
      .map((g) => {
        const o = g as { title?: unknown; name?: unknown; done?: unknown; completed?: unknown; status?: unknown };
        const title = str(o.title) ?? str(o.name);
        if (!title) return null;
        const done = o.done === true || o.completed === true || o.status === 'done';
        return { title, done };
      })
      .filter((g): g is { title: string; done: boolean } => g !== null)
      .slice(0, 5);

    // Focus — from preferences (self-declared).
    const prefs = prefsRaw as { focus?: unknown; data?: { focus?: unknown } } | null;
    out.focus = str(prefs?.focus) ?? str(prefs?.data?.focus);

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

    return sealed(out);
  },
});
