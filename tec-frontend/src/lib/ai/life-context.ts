/**
 * Life context for the assistant — through Life's CONSENT-GATED door, nothing else.
 *
 * `/api/bff/ai/context` used to read `/identity/life/goals` and `/preferences`
 * as the user and hand the titles to the model. That read ignored the grants the
 * person set on Life's Privacy screen ("what can be shared with TEC AI"): a goal
 * they had switched OFF still reached the prompt. C-106 §5 requires explicit
 * consent per category before any AI consumption, and Life built the door for
 * exactly this reader (`GET /identity/life/context/:username`, C-106 §11b) —
 * served categories only, the consent map travelling with the payload, every
 * read audited with the reader's name. This is its first consumer.
 *
 * A1 (tracker tec-knowledge-base #199): the door already served the skills
 * ladder and the trajectory as a pace when granted, and this file threw them
 * away. Now it keeps them — narrowed the same way: a category absent from the
 * payload was not served; a level is one of the four ladder words or nothing;
 * a pace is kept only when Life itself said it is projectable (a refusal stays
 * a refusal — never fill the gap). ACTIVITY is never served by the door and is
 * never asked for here.
 *
 * BUDGET (C-106 §10 Phase 1, L1): the caps a person set per app for this month,
 * when granted. They are LIMITS, not spending — payment-service owns what was
 * spent, and the assistant is told it does not know it. A cap stays the string
 * Life wrote (DECIMAL(20,8), C-47); one that is not a positive decimal is dropped.
 *
 * Pure: no fetch here. The route fetches; this narrows what came back.
 */

export const SKILL_LEVELS = ['LEARNING', 'PRACTISING', 'PROFICIENT', 'EXPERT'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface AiLifeContext {
  /** Active goals the person has CONSENTED to share — titles only. */
  goals: { title: string; done: boolean }[];
  /** Their stated focus, when PREFERENCES is granted. */
  focus?: string;
  /** Up to five skills with their ladder word (never a number), when SKILLS is granted. */
  skills?: { name: string; level: SkillLevel }[];
  /** Their pace from their own logged steps, only when TRAJECTORY is granted AND Life calls it projectable. */
  pace?: { pi_per_week: number; active_days: number };
  /** This month's self-declared caps per app, when BUDGET is granted — limits, never spending. */
  budget?: AiLifeBudget;
  /** What they granted, so the prompt can say "not shared" instead of "none". */
  consent: Record<string, boolean>;
}

export interface AiLifeBudget {
  /** UTC month, YYYY-MM. */
  period: string;
  /** cap_pi is a positive decimal string with at most 8 places — as Life stores it. */
  caps:   { category: string; cap_pi: string }[];
}

const BUDGET_PERIOD   = /^\d{4}-(0[1-9]|1[0-2])$/;
const BUDGET_CATEGORY = /^[a-z][a-z0-9_-]{0,31}$/;      // Life's own rule (identity-service)
const BUDGET_CAP      = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/;
const MAX_CAPS        = 12;

/** Narrow a served budget; undefined when absent or its month is not a month. Shared with the token's re-narrowing. */
export function narrowBudget(raw: unknown): AiLifeBudget | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as { period?: unknown; caps?: unknown };
  if (typeof b.period !== 'string' || !BUDGET_PERIOD.test(b.period)) return undefined;
  const caps = (Array.isArray(b.caps) ? b.caps : [])
    .map((c) => {
      const o = c as { category?: unknown; cap_pi?: unknown };
      const ok = typeof o?.category === 'string' && BUDGET_CATEGORY.test(o.category)
        && typeof o.cap_pi === 'string' && BUDGET_CAP.test(o.cap_pi) && Number(o.cap_pi) > 0;
      return ok ? { category: o.category as string, cap_pi: o.cap_pi as string } : undefined;
    })
    .filter((c): c is { category: string; cap_pi: string } => c !== undefined)
    .slice(0, MAX_CAPS);
  return { period: b.period, caps };
}

/**
 * The system-prompt line for a budget — empty when none was served. It says what
 * the caps are (their own limits) and what the assistant does not know (spending).
 */
export function budgetPromptLine(budget: AiLifeBudget | undefined): string {
  if (!budget) return '';
  if (!budget.caps.length) {
    return `- Budget (Life): shared, but no caps set for ${budget.period}. If money planning comes up, they can set a monthly cap per app in Life → Budget.`;
  }
  const caps = budget.caps.map((c) => `${c.category} ≤ ${c.cap_pi} π`).join('; ');
  return `- Budget caps they set in Life for ${budget.period} (their own limits, not spending): ${caps}. `
    + 'You do not know what they spent — Life shows it beside each cap on its Home; point there for it. '
    + 'Use the caps to help them stay inside their own plan; never shame, never invent a total.';
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

export function lifeContextToAi(payload: unknown): AiLifeContext {
  const root = (payload as { data?: unknown })?.data ?? payload;
  const r    = (root ?? {}) as { consent?: unknown; context?: unknown };
  const consent: Record<string, boolean> = {};
  for (const c of Array.isArray(r.consent) ? r.consent : []) {
    const o = c as { category?: unknown; granted?: unknown };
    if (typeof o.category === 'string') consent[o.category] = o.granted === true;
  }
  const ctx = (r.context ?? {}) as { goals?: unknown; preferences?: unknown; skills?: unknown; trajectory?: unknown; budget?: unknown };
  // A category that is absent from the context was not served — denied, or
  // nothing there. Never read a table the service did not hand over.
  const goals = (Array.isArray(ctx.goals) ? ctx.goals : [])
    .map((g) => str((g as { title?: unknown })?.title))
    .filter((t): t is string => t !== undefined)
    .slice(0, 5)
    .map((title) => ({ title, done: false }));   // the door serves ACTIVE goals only
  const prefs = (ctx.preferences ?? {}) as { focus?: unknown };

  const skillRows = (Array.isArray(ctx.skills) ? ctx.skills : [])
    .map((s) => {
      const o = s as { name?: unknown; level?: unknown };
      const name  = str(o.name);
      const level = typeof o.level === 'string' && (SKILL_LEVELS as readonly string[]).includes(o.level) ? (o.level as SkillLevel) : undefined;
      return name && level ? { name, level } : undefined;
    })
    .filter((s): s is { name: string; level: SkillLevel } => s !== undefined)
    .slice(0, 5);
  const skills = Array.isArray(ctx.skills) ? skillRows : undefined;

  const t = (ctx.trajectory ?? null) as { projectable?: unknown; pi_per_week?: unknown; active_days?: unknown } | null;
  const perWeek = num(t?.pi_per_week); const days = num(t?.active_days);
  const pace = t && t.projectable === true && perWeek !== undefined && days !== undefined
    ? { pi_per_week: perWeek, active_days: days }
    : undefined;

  return { goals, focus: str(prefs.focus), skills, pace, budget: narrowBudget(ctx.budget), consent };
}
