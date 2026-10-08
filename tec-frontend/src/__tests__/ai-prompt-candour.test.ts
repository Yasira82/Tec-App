/**
 * What the second reading said about the ANSWERS, not the classifier (owner, 2026-10-08):
 * "I see no real value in you", "are you just a bot?", "update yourself", "you went
 * straight to Commerce", "can you see my goals in Life?". Each rule below answers one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEC_SYSTEM_PROMPT, PLATFORM_SNAPSHOT_DATE } from '@/lib/ai/tec-ai-system-prompt';

const route = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');

describe('the assistant is candid about TEC', () => {
  it('answers a criticism with the real weaknesses, not a feature list', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/Candour over defence/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/Never answer a criticism by listing features/);
  });

  it('names the weaknesses that are true today', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/Payouts are by hand/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/previews or early/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/one person runs the platform/);
  });
});

describe('the assistant says what it is and what it can see', () => {
  it('says it is an AI when asked', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/are you\s+just a bot/);
  });

  it('explains absent Life data instead of pretending either way', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/Life → Privacy/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/never claim you cannot see Life at all/);
  });

  it('a signed-in user with no goals in context gets an explicit line', () => {
    expect(route).toMatch(/Life goals: NONE shared with you/);
  });

  it('cannot search a catalogue and says so, pointing to the shop', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/cannot search the\s+catalogue yourself/);
  });
});

describe('recommending', () => {
  it('Commerce only for buying or selling, and a refused kind is never recommended', () => {
    expect(TEC_SYSTEM_PROMPT).toMatch(/Recommend Commerce or Ecommerce only when they want to buy or sell/);
    expect(TEC_SYSTEM_PROMPT).toMatch(/never recommend that kind/);
  });
});

describe('the platform snapshot stays fresh', () => {
  it('is dated, and the prompt carries the date', () => {
    expect(PLATFORM_SNAPSHOT_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TEC_SYSTEM_PROMPT).toContain(`TEC TODAY (snapshot ${PLATFORM_SNAPSHOT_DATE}`);
  });

  it('is no older than 60 days — refresh it from KB C-02 and move the date', () => {
    const ageDays = (Date.now() - Date.parse(`${PLATFORM_SNAPSHOT_DATE}T00:00:00Z`)) / 86_400_000;
    expect(ageDays).toBeLessThanOrEqual(60);
  });
});
