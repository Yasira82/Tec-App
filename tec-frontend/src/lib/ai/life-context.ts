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
  /** What they granted, so the prompt can say "not shared" instead of "none". */
  consent: Record<string, boolean>;
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
  const ctx = (r.context ?? {}) as { goals?: unknown; preferences?: unknown; skills?: unknown; trajectory?: unknown };
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

  return { goals, focus: str(prefs.focus), skills, pace, consent };
}
