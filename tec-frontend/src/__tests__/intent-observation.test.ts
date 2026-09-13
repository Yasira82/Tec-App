import {
  observeIntent,
  fingerprintOf,
  OBJECTIVES,
  type IntentObservation,
} from '@/lib/ai/intent-observation';

// TEC AI — the Intent Observation compiler (IIC 3.3).
//
// The instrument's job is not to classify well. It is to be HONEST about what it could
// not classify, because the unmatched rows are the whole reason it exists: they are the
// evidence that the closed objective set (IIC 4.3) is incomplete, and the only thing
// that says what it is missing.
//
// So the tests that matter most here are the ones about `null`.

const observe = (ask: string, locale?: 'en' | 'ar') =>
  observeIntent(ask, locale ? { locale } : {}) as Promise<IntentObservation>;

describe('observeIntent — the closed set, and where it fails', () => {
  it('matches an objective and records no excerpt of the ask', async () => {
    const o = await observe('I want to buy a laptop');
    expect(o.objective).toBe('find_product');
    expect(o.entities).toEqual({ category: 'laptop' });
    // With a match, the user's words buy nothing — so they are not stored.
    expect(o.ask).toBeUndefined();
  });

  it('returns objective: null AND the excerpt when nothing matches', async () => {
    // THE POINT OF THE WHOLE STEP. A compiler that always found something would report a
    // complete vocabulary on day one and be wrong in a way nobody could see.
    const o = await observe('can I lease a cargo truck for my factory with Pi?');
    expect(o.objective).toBeNull();
    expect(o.ask).toBe('can I lease a cargo truck for my factory with Pi?');
  });

  it('caps the excerpt rather than storing an essay', async () => {
    const o = await observe(`${'z'.repeat(400)} qqq`);
    expect(o.objective).toBeNull();
    expect(o.ask!.length).toBeLessThanOrEqual(160);
  });

  it('says nothing at all for an ask with nothing in it', async () => {
    // An observation with no objective AND no useful excerpt teaches nobody anything,
    // and a table of them makes the real unmatched rows harder to find.
    expect(await observeIntent('')).toBeNull();
    expect(await observeIntent('  ')).toBeNull();
    expect(await observeIntent('hi')).toBeNull();
  });

  it('every detected objective is a member of the declared set', async () => {
    const asks = ['buy a phone', 'pay now', 'check my balance', 'send pi to my friend',
                  'where is my order', 'start kyc', 'upgrade to pro', 'referral link',
                  'I want to sell', 'my nft assets', 'shops that accepts pi near me',
                  'any hackathon?', 'start a project', 'my reputation', 'what is tec'];
    for (const ask of asks) {
      const o = await observe(ask);
      expect(o.objective).not.toBeNull();
      expect(OBJECTIVES).toContain(o.objective!);
    }
  });
});

describe('Arabic is read, not discarded', () => {
  // A detector that cannot normalize reports "no objective matched" for an ask it
  // understands perfectly well — which poisons the very dataset this exists to collect.
  it('matches through alef/ta-marbuta/yaa variants', async () => {
    expect((await observe('عايز أشتري لابتوب', 'ar')).objective).toBe('find_product');
    expect((await observe('عايز اشتري لاب توب', 'ar')).objective).toBe('find_product');
  });

  it('reads Arabic-Indic digits as numbers', async () => {
    const o = await observe('عايز اشتري لابتوب تحت ٢٥٠ باي', 'ar');
    expect(o.objective).toBe('find_product');
    expect(o.constraints[0]).toMatchObject({ key: 'budget_pi', op: 'lte', value: 250 });
  });

  it('carries the locale when it was given, and omits it when it was not', async () => {
    expect((await observe('اشتري لابتوب', 'ar')).locale).toBe('ar');
    expect((await observe('buy a laptop')).locale).toBeUndefined();
  });
});

describe('constraints come from the user, never from the compiler', () => {
  it('records a stated budget with the span it came from', async () => {
    const o = await observe('find a phone under 250 pi');
    expect(o.constraints).toEqual([
      { key: 'budget_pi', op: 'lte', value: 250, class: 'hard', quote: 'under 250 pi' },
    ]);
    expect(o.authority.max_total_pi).toBe(250);
  });

  it('records NO budget when the user stated none', async () => {
    // An inferred budget is a number the platform made up about somebody's money.
    const o = await observe('I want to buy a laptop');
    expect(o.constraints).toEqual([]);
    expect(o.authority.max_total_pi).toBeNull();
  });

  it('does not read a bare amount as a budget outside a buying ask', async () => {
    // "send 50 pi to my friend" states an amount, not a ceiling on a search.
    const o = await observe('send 50 pi to my friend');
    expect(o.objective).toBe('send_pi');
    expect(o.constraints).toEqual([]);
  });

  it('records only exclusions the user stated outright', async () => {
    expect((await observe('buy a phone, verified only')).exclusions).toEqual(['unverified_sellers']);
    expect((await observe('buy a phone')).exclusions).toEqual([]);
  });
});

describe('the shape the sink will accept', () => {
  it('always requires a human checkpoint (spec §3)', async () => {
    // An intent may narrow what a human is asked to approve; it may never remove the
    // asking. There is no input that produces an empty requires_human_at, and the sink
    // refuses one anyway.
    for (const ask of ['buy a laptop', 'pay now', 'something we do not model at all']) {
      expect((await observe(ask)).authority.requires_human_at).toEqual(['payment']);
    }
  });

  it('emits v1 and a surface', async () => {
    const o = await observe('buy a laptop');
    expect(o.v).toBe(1);
    expect(o.surface).toBe('tec_ai_chat');
  });
});

describe('fingerprint — binding fields only (spec §4.2)', () => {
  const binding = {
    objective:   'find_product',
    entities:    { category: 'laptop' },
    constraints: [{ key: 'budget_pi', op: 'lte' as const, value: 250, class: 'hard' as const }],
    exclusions:  ['auction'],
    authority:   { max_total_pi: 250, services: [], requires_human_at: ['payment'] },
  };

  it('is a sha256 hex digest', async () => {
    expect(await fingerprintOf(binding)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable regardless of key order — the same intent hashes the same', async () => {
    const reordered = {
      authority:   binding.authority,
      exclusions:  binding.exclusions,
      constraints: binding.constraints,
      entities:    binding.entities,
      objective:   binding.objective,
    };
    expect(await fingerprintOf(reordered)).toBe(await fingerprintOf(binding));
  });

  it('MOVES when a hard constraint is loosened', async () => {
    // This is the whole property: drift on a binding field must be detectable without
    // trusting anyone's report of it.
    const loosened = {
      ...binding,
      constraints: [{ ...binding.constraints[0], value: 900 }],
    };
    expect(await fingerprintOf(loosened)).not.toBe(await fingerprintOf(binding));
  });

  it('MOVES when the objective changes', async () => {
    expect(await fingerprintOf({ ...binding, objective: 'sell_product' }))
      .not.toBe(await fingerprintOf(binding));
  });

  it('does NOT move for a field outside the binding set', async () => {
    // Locale and surface are not part of the fingerprint: neither is a constraint on
    // what the platform may do, so neither is drift.
    const a = await observe('buy a laptop under 250 pi');
    const b = await observe('buy a laptop under 250 pi', 'ar');
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});
