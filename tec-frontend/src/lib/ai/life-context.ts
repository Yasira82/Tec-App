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
 * Pure: no fetch here. The route fetches; this narrows what came back.
 */

export interface AiLifeContext {
  /** Active goals the person has CONSENTED to share — titles only. */
  goals: { title: string; done: boolean }[];
  /** Their stated focus, when PREFERENCES is granted. */
  focus?: string;
  /** What they granted, so the prompt can say "not shared" instead of "none". */
  consent: Record<string, boolean>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function lifeContextToAi(payload: unknown): AiLifeContext {
  const root = (payload as { data?: unknown })?.data ?? payload;
  const r    = (root ?? {}) as { consent?: unknown; context?: unknown };
  const consent: Record<string, boolean> = {};
  for (const c of Array.isArray(r.consent) ? r.consent : []) {
    const o = c as { category?: unknown; granted?: unknown };
    if (typeof o.category === 'string') consent[o.category] = o.granted === true;
  }
  const ctx = (r.context ?? {}) as { goals?: unknown; preferences?: unknown };
  // A category that is absent from the context was not served — denied, or
  // nothing there. Never read a table the service did not hand over.
  const goals = (Array.isArray(ctx.goals) ? ctx.goals : [])
    .map((g) => str((g as { title?: unknown })?.title))
    .filter((t): t is string => t !== undefined)
    .slice(0, 5)
    .map((title) => ({ title, done: false }));   // the door serves ACTIVE goals only
  const prefs = (ctx.preferences ?? {}) as { focus?: unknown };
  return { goals, focus: str(prefs.focus), consent };
}
