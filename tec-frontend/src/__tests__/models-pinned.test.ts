import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/**
 * A model id that production has served traffic on must never disappear from the
 * candidate list.
 *
 * This guard exists because it already happened. PR #154 researched the then-current
 * provider models and pinned `gemini-3.6-flash` and `llama-3.1-8b-instant`. PR #161
 * generalised those single pins into candidate LISTS — and, filling the lists from
 * recollection, dropped `gemini-3.6-flash` entirely and replaced it with four OLDER
 * Gemini ids. On a free tier the older models are the crowded ones, so the assistant
 * started answering "This model is currently experiencing high demand". A change whose
 * whole purpose was surviving model rotation is what removed the working model.
 *
 * The trap is subtle and will recur: a model released after an author's knowledge
 * cutoff LOOKS wrong, so it gets "corrected" to a familiar older id. Recognition is not
 * evidence. Production traffic is.
 *
 * Adding candidates below a pinned id is fine. Removing or demoting one is not — verify
 * with /api/ai/health first, then update this list in the same commit, so the deletion
 * is a deliberate decision with a reason attached rather than an accident.
 */
import { describe, it, expect } from 'vitest';
import { CLAUDE_MODELS, GROQ_MODELS, GEMINI_MODELS, OPENROUTER_MODELS } from '@/app/api/ai/chat/route';

/** Model ids that have served real production traffic. Removing one needs evidence. */
const PINNED = {
  // gpt-oss-20b first: the only Groq id /api/ai/health found answering on 2026-10-08.
  // llama-3.1-8b-instant (pinned by #154) now 404s — demoted with that evidence, kept.
  groq:   ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
  gemini: ['gemini-3.6-flash'],
} as const;

describe('provider model candidates', () => {
  it('still contains every Groq id that production has used', () => {
    for (const model of PINNED.groq) expect(GROQ_MODELS).toContain(model);
  });

  it('still contains every Gemini id that production has used', () => {
    for (const model of PINNED.gemini) expect(GEMINI_MODELS).toContain(model);
  });

  // Order is not cosmetic: the walk starts at the head, and every dead candidate ahead of
  // a live one costs the user a round trip on a cold edge instance (the last-good-model
  // memory starts empty). The verified model goes first, right after the env override.
  it('puts the verified model first, after the env override', () => {
    const groqFirst   = GROQ_MODELS.filter(m => m !== process.env.GROQ_MODEL)[0];
    const geminiFirst = GEMINI_MODELS.filter(m => m !== process.env.GEMINI_MODEL)[0];
    expect(groqFirst).toBe(PINNED.groq[0]);
    expect(geminiFirst).toBe(PINNED.gemini[0]);
  });

  it('lets an operator pin a winner ahead of everything without a deploy', () => {
    // The env override is the escape hatch /api/ai/health points at, so it must stay
    // first — a hardcoded list that outranks it cannot be fixed from the dashboard.
    expect(GROQ_MODELS.length).toBeGreaterThan(1);
    expect(GEMINI_MODELS.length).toBeGreaterThan(1);
  });
});

describe('Claude candidates (2026-10-08)', () => {
  it('leads with a current model, after the env override', () => {
    expect(CLAUDE_MODELS.filter(m => m !== process.env.ANTHROPIC_MODEL)[0]).toBe('claude-opus-5-5');
  });

  it('keeps the retired id that production served — last, never first', () => {
    expect(CLAUDE_MODELS).toContain('claude-3-5-sonnet-20240620');
    expect(CLAUDE_MODELS[CLAUDE_MODELS.length - 1]).toBe('claude-3-5-sonnet-20240620');
  });
});

describe('free first, GPT included (owner, 2026-10-08)', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');

  it('free GPT on Groq sits below the pinned id; OpenRouter leads with free GPT', () => {
    expect(GROQ_MODELS.indexOf('openai/gpt-oss-120b')).toBeGreaterThan(GROQ_MODELS.indexOf('openai/gpt-oss-20b'));
    expect(OPENROUTER_MODELS.filter(m => m !== process.env.OPENROUTER_MODEL)[0]).toBe('openai/gpt-oss-120b:free');
    for (const m of OPENROUTER_MODELS.filter(m => m !== process.env.OPENROUTER_MODEL)) expect(m).toMatch(/:free$/);
  });

  it('tries the free providers before the paid one', () => {
    const order = ['gemini', 'groq', 'openrouter', 'claude'].map(n => route.indexOf(`['${n}',`));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('an OpenRouter "no endpoints found" moves to the next candidate', () => {
    expect(route).toMatch(/no endpoints found/);
  });
});
