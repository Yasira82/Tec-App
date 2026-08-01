import { createHandler } from '@/lib/bff/createHandler';

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
  kycVerified: boolean;
  goals:       { title: string; done: boolean }[];
  focus?:      string;
  activity?:   { logins?: number; payments?: number; volume?: string };
}

export const GET = createHandler<Record<string, never>, AiContext>({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const gateway = process.env.API_GATEWAY_URL ?? '';
    const token   = req.cookies.get('tec_access_token')?.value ?? '';

    const out: AiContext = { kycVerified: ctx.kycVerified, goals: [] };
    if (!gateway || !token) return out; // fail-soft: base context only

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

    return out;
  },
});
