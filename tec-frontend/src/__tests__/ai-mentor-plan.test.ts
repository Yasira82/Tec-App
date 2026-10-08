/**
 * TEC AI as a mentor for the whole person (owner, 2026-10-08), step 1: a plan it works out
 * with someone travels to Life as a goal WITH its steps, and Life saves nothing until Add.
 */
import { describe, it, expect } from 'vitest';
import { parseNavIntents, prefillQuery } from '@/lib/ai/nav-intents';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';

describe('steps travel with the goal', () => {
  it('steps → steps: split on ";", collapsed, capped at 80 each and five in all', () => {
    const q = new URLSearchParams(prefillQuery('life:goal',
      `title=Read%20more&steps=${encodeURIComponent('Pick a book; ;20  pages a day;' + 'x'.repeat(120) + ';d;e;f;g')}`));
    expect(q.get('goal')).toBe('Read more');
    const steps = q.get('steps')!.split(';');
    expect(steps).toHaveLength(5);
    expect(steps.slice(0, 2)).toEqual(['Pick a book', '20 pages a day']);
    expect(steps[2]).toHaveLength(80);
  });

  it('steps without a title are no proposal', () => {
    expect(prefillQuery('life:goal', 'steps=a;b')).toBe('');
  });

  it('the chip opens Life\'s form with both', () => {
    const r = parseNavIntents('Here is a start. [[go:life:goal?title=Read%20more&steps=Pick%20a%20book;20%20pages%20a%20day]]');
    const href = new URL(r.intents[0]!.href);
    expect(href.searchParams.get('goal')).toBe('Read more');
    expect(href.searchParams.get('steps')).toBe('Pick a book;20 pages a day');
    expect(r.clean).toBe('Here is a start.');
  });
});

describe('the mentor in the prompt', () => {
  it('covers the whole person, starts from them, small steps', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/## A MENTOR FOR THE WHOLE PERSON/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/money, work, skills, learning,\s+health habits/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/ask ONE short question first/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/3–5 small, concrete steps/);
  });

  it('knows its limits, and puts safety before coaching', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/not a doctor, psychologist, lawyer or financial adviser/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/stop coaching: answer with care, urge them to contact local emergency services/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/No diets, medication, doses or risky challenges/);
  });

  it('the steps are offered as its suggestion, kept or removed in Life', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/&steps=\s*<step one>;<step two>;<step three>/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/The steps are YOUR suggestion/);
  });
});
