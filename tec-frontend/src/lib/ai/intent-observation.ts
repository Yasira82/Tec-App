/**
 * TEC AI — the Intent Observation compiler (IIC 3.3).
 *
 * From what a user actually asked, build the structured intent object the platform
 * would later hand to a gate — **and do nothing with it**. Nothing reads this to decide
 * anything: no routing changes, no answer changes, no execution. It is an instrument.
 *
 * ── Why it exists, stated plainly ───────────────────────────────────────────────
 * IIC 4.3 needs a CLOSED set of objectives, because a free-text goal cannot be compared
 * between versions — and drift on the goal is the one thing that must never go
 * unmeasured (spec §4.1). The platform has made this call twice already and was right
 * both times: a LADDER on Life's skills instead of a score out of ten, a closed set on
 * Life's intent-signal kinds.
 *
 * The only honest way to design that set is from asks people actually made. So this
 * file ships the set as it stands today — and, more importantly, ships the machinery to
 * find out where it is WRONG.
 *
 * ── The rule that shapes everything below ───────────────────────────────────────
 * **`null` is a first-class answer.** When no objective matches, this returns `null` and
 * an excerpt of the ask. That row is the most valuable one the instrument produces: it
 * says the closed set is incomplete, and it says what it is missing. A compiler that
 * always finds something to return would report a complete vocabulary on day one and be
 * wrong in a way nobody could see.
 *
 * The same rule applies to constraints: only values the user literally stated are
 * recorded, each with the span it came from. An inferred budget is a number the platform
 * made up about somebody's money.
 */

/**
 * The closed objective set, **v0**.
 *
 * Each entry is something a TEC app actually does today — a vocabulary of imagination
 * would produce observations that match nothing real. This list is the SINGLE
 * definition: `tec-analytics-service` deliberately holds no copy, and validates shape
 * only, so an objective outside this set is still recorded rather than rejected (P2).
 *
 * Expect this to change. That is the point.
 */
export const OBJECTIVES = [
  'find_product',
  'sell_product',
  'make_payment',
  'check_balance',
  'send_pi',
  'track_order',
  'verify_identity',
  'subscribe',
  'invite_others',
  'manage_assets',
  'find_business',
  'find_opportunity',
  'create_project',
  'check_reputation',
  'understand_platform',
] as const;

export type Objective = (typeof OBJECTIVES)[number];

export interface ObservedConstraint {
  key:    string;
  op:     'lte' | 'gte' | 'eq' | 'neq';
  value:  number | string;
  class:  'hard' | 'soft';
  /** The span of the user's own words the value came from. Never a paraphrase. */
  quote?: string;
}

export interface IntentObservation {
  v:           1;
  objective:   Objective | null;
  entities:    Record<string, string>;
  constraints: ObservedConstraint[];
  exclusions:  string[];
  authority: {
    max_total_pi:      number | null;
    services:          string[];
    /**
     * v0.1 §3 — an intent may narrow what a human is asked to approve; it may never
     * remove the asking. Non-empty by construction, and the sink refuses it empty.
     */
    requires_human_at: string[];
  };
  surface:     string;
  locale?:     'en' | 'ar';
  fingerprint: string;
  /** Capped excerpt — present ONLY when nothing in the closed set matched. */
  ask?:        string;
}

/**
 * Arabic normalization, applied to the ask before matching.
 *
 * Same shape as Explorer's search normalizer and for the same reason: a user typing
 * "أشترى" and a keyword spelled "اشتري" are the same word, and a detector that cannot
 * see that reports "no objective matched" for an ask it understands perfectly well —
 * which would poison the very dataset this exists to collect.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))   // Arabic-Indic digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))   // Persian digits
    .replace(/[ـ]/g, '')                                               // tatweel
    .replace(/[ً-ْ]/g, '')                                        // harakat
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Objective detection vocabulary. Each objective lists normalized substrings in both
 * languages; the FIRST objective with a hit wins, so the order is the tie-break and the
 * more specific objectives come first.
 */
const VOCABULARY: [Objective, Needle[]][] = [
  // A regex, because the amount usually sits between the verb and the unit: "send 50 pi
  // to my friend" is the ordinary phrasing, and an adjacent-words match misses it.
  ['send_pi',             [/\bsend\b.{0,12}\bpi\b/, /\btransfer\b.{0,12}\bpi\b/, 'ابعت', 'احول', 'تحويل باي']],
  ['check_balance',       ['balance', 'my wallet', 'how much pi do i', 'رصيد', 'محفظتي']],
  ['track_order',         ['my order', 'order status', 'where is my', 'طلبي', 'حاله الطلب']],
  ['verify_identity',     ['kyc', 'verify my', 'verification', 'توثيق', 'تحقق من هويت']],
  ['subscribe',           ['subscribe', 'pro plan', 'upgrade to pro', 'اشتراك', 'الباقه', 'باقات']],
  ['invite_others',       ['referral', 'invite', 'refer a friend', 'دعوه', 'ادعو', 'احاله']],
  ['sell_product',        ['sell', 'list my product', 'become a merchant', 'my store', 'ابيع', 'متجري', 'تاجر']],
  ['manage_assets',       ['nft', 'my assets', 'digital asset', 'اصولي', 'الاصول الرقميه']],
  ['find_business',       ['near me', 'accepts pi', 'shops that', 'قريب مني', 'يقبل باي', 'محلات']],
  ['find_opportunity',    ['job', 'hiring', 'grant', 'hackathon', 'co-founder', 'وظيف', 'فرصه', 'منحه']],
  ['create_project',      ['start a project', 'launch a', 'build a community', 'مشروع جديد', 'اطلق']],
  ['check_reputation',    ['reputation', 'my score', 'achievements', 'سمعه', 'انجازات', 'تقييمي']],
  ['make_payment',        ['pay', 'checkout', 'buy now', 'ادفع', 'الدفع', 'اشتري ده']],
  ['find_product',        ['buy', 'looking for a', 'find a', 'shop for', 'اشتري', 'ادور علي', 'عايز اشتري']],
  ['understand_platform', ['what is tec', 'what can i do', 'how does', 'ايه هو تك', 'اعمل ايه', 'ازاي']],
];

/** Numeric budget: "under 250 pi", "أقل من 250 باي", "max 100π". */
const BUDGET = /(?:under|below|less than|max(?:imum)?|up to|within|اقل من|تحت|بحد اقصي|في حدود)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:pi|π|باي|باي كوين)?/i;
/** A bare "<n> pi" is a budget only when the ask is clearly about buying. */
const BARE_PI = /([0-9]+(?:\.[0-9]+)?)\s*(?:pi|π|باي)\b/i;

/** Exclusions the user stated outright. Deliberately few — a guess here is a lie. */
const EXCLUSION_VOCABULARY: [string, Needle[]][] = [
  ['unverified_sellers', ['verified only', 'no untrusted', 'trusted seller', 'موثق فقط', 'بايع موثوق']],
  ['auction',            ['no auction', 'not an auction', 'مش مزاد', 'بدون مزاد']],
  ['pre_order',          ['no pre-order', 'no preorder', 'مش حجز', 'بدون حجز']],
];

const BUYING: Objective[] = ['find_product', 'make_payment', 'sell_product'];

/** The lowercase entity keys this compiler will record, and nothing else. */
const CATEGORY_VOCABULARY: [string, Needle[]][] = [
  ['laptop',   ['laptop', 'لابتوب', 'لاب توب']],
  ['phone',    ['phone', 'mobile', 'موبايل', 'تليفون']],
  ['clothing', ['clothes', 'shirt', 'ملابس', 'هدوم']],
  ['food',     ['food', 'restaurant', 'اكل', 'مطعم']],
  ['property', ['apartment', 'house', 'rent a', 'شقه', 'بيت', 'ايجار']],
  ['service',  ['service', 'freelancer', 'خدمه', 'فريلانسر']],
];

/** A substring, or a pattern where the words are not adjacent. */
type Needle = string | RegExp;

const firstHit = <T>(pairs: [T, Needle[]][], hay: string): T | null => {
  for (const [key, needles] of pairs) {
    if (needles.some((n) => (typeof n === 'string' ? hay.includes(n) : n.test(hay)))) return key;
  }
  return null;
};

/** Stable stringify so the same intent always fingerprints the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * sha256 over the BINDING fields only (spec §4.2).
 *
 * Preferences are excluded on purpose: a preference that shifts is an agent doing its
 * job, while a constraint, exclusion, authority limit or the objective moving IS drift.
 * Web Crypto, so this runs unchanged on the Edge runtime the chat route uses.
 */
export async function fingerprintOf(binding: {
  objective:   string | null;
  entities:    Record<string, string>;
  constraints: ObservedConstraint[];
  exclusions:  string[];
  authority:   IntentObservation['authority'];
}): Promise<string> {
  const bytes  = new TextEncoder().encode(canonical(binding));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Excerpt cap — matches the sink's bound, so a valid observation is never refused. */
const ASK_MAX   = 160;
const QUOTE_MAX = 80;

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

export interface ObserveOptions {
  locale?:  'en' | 'ar';
  surface?: string;
}

/**
 * Compile one user turn into an intent observation.
 *
 * PURE apart from the hash (Web Crypto), so every rule above is directly testable with
 * no infrastructure — the same property that makes IIC 4.2 worth writing early.
 *
 * Returns null for an ask with nothing in it (empty or trivially short): an observation
 * carrying no objective AND no excerpt teaches nobody anything, and a table of them
 * would make the real unmatched rows harder to find.
 */
export async function observeIntent(
  ask: string,
  opts: ObserveOptions = {},
): Promise<IntentObservation | null> {
  const raw = (ask ?? '').trim();
  if (raw.length < 3) return null;

  const hay = normalize(raw);

  const objective = firstHit(VOCABULARY, hay);

  // Constraints — only what the user said, with the span it came from.
  const constraints: ObservedConstraint[] = [];
  const budgetMatch = BUDGET.exec(hay)
    ?? (objective && BUYING.includes(objective) ? BARE_PI.exec(hay) : null);
  if (budgetMatch) {
    const value = Number(budgetMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      constraints.push({
        key:   'budget_pi',
        op:    'lte',
        value,
        class: 'hard',
        quote: clip(budgetMatch[0].trim(), QUOTE_MAX),
      });
    }
  }

  const exclusion = firstHit(EXCLUSION_VOCABULARY, hay);
  const exclusions = exclusion ? [exclusion] : [];

  const category = firstHit(CATEGORY_VOCABULARY, hay);
  const entities: Record<string, string> = category ? { category } : {};

  const authority: IntentObservation['authority'] = {
    max_total_pi: constraints.find((c) => c.key === 'budget_pi')?.value as number ?? null,
    services:     [],
    // Always non-empty (v0.1 §3). The observation records that a human checkpoint is
    // required; it never records one being waived, because v0.1 has no such shape.
    requires_human_at: ['payment'],
  };

  const fingerprint = await fingerprintOf({ objective, entities, constraints, exclusions, authority });

  return {
    v: 1,
    objective,
    entities,
    constraints,
    exclusions,
    authority,
    surface: opts.surface ?? 'tec_ai_chat',
    ...(opts.locale ? { locale: opts.locale } : {}),
    fingerprint,
    // Only when the closed set failed. With a match, the excerpt would be exposure that
    // buys nothing; without one, it is the entire finding.
    ...(objective === null ? { ask: clip(raw, ASK_MAX) } : {}),
  };
}
