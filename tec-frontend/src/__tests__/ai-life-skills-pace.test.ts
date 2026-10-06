/**
 * A1 — the assistant reads what Life's door already serves: skills and pace,
 * consent-gated (tracker tec-knowledge-base #199 · Tec-App #286).
 *
 * The door served the skills ladder and the trajectory as a pace whenever the
 * person had granted them, and `life-context.ts` threw both away. Now it keeps
 * them, narrowed the same way as goals: absent from the payload = not served;
 * a level is one of the four ladder words or nothing; a pace only when Life
 * itself said it is projectable. The signed token carries them and re-narrows
 * them on the way out; the prompt names how to use them — route toward, never
 * grade; encourage, never judge; never a number the context does not hold.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import { lifeContextToAi, SKILL_LEVELS } from '@/lib/ai/life-context';
import { signContext, verifyContext } from '@/lib/ai/context-token';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const SECRET = 'a-32-character-secret-for-tests!!';

const served = (context: Record<string, unknown>, consent: Record<string, boolean> = {}) => ({
  data: { consent: Object.entries(consent).map(([category, granted]) => ({ category, granted })), context },
});

describe('lifeContextToAi — skills', () => {
  it('SKILLS granted → up to five (name, ladder word); a numeric or unknown level is dropped, never invented', () => {
    const r = lifeContextToAi(served({ skills: [
      { name: 'Design', level: 'EXPERT', source: 'SELF_DECLARED' },
      { name: 'Sales',  level: 'PRACTISING' },
      { name: 'Scored', level: 7 },            // a number is not a ladder word
      { name: 'Made up', level: 'GURU' },      // not on the ladder
      { name: '',        level: 'EXPERT' },    // no name
      { name: 'A', level: 'LEARNING' }, { name: 'B', level: 'LEARNING' }, { name: 'C', level: 'LEARNING' }, { name: 'D', level: 'LEARNING' },
    ] }, { SKILLS: true }));
    expect(r.skills).toEqual([
      { name: 'Design', level: 'EXPERT' }, { name: 'Sales', level: 'PRACTISING' },
      { name: 'A', level: 'LEARNING' }, { name: 'B', level: 'LEARNING' }, { name: 'C', level: 'LEARNING' },
    ]);
    for (const s of r.skills ?? []) expect(SKILL_LEVELS).toContain(s.level);
  });

  it('SKILLS not served → undefined (not an empty list): "not shared" and "none" are different answers', () => {
    expect(lifeContextToAi(served({ goals: [] }, { SKILLS: false })).skills).toBeUndefined();
    expect(lifeContextToAi(served({ skills: [] }, { SKILLS: true })).skills).toEqual([]);
  });
});

describe('lifeContextToAi — pace', () => {
  it('TRAJECTORY granted and projectable → the pace, nothing else of the log', () => {
    const r = lifeContextToAi(served({ trajectory: { pi_per_week: 17.5, active_days: 4, projectable: true, goals: [{ id: 'g1', eta_days: 3 }], entries: 9 } }, { TRAJECTORY: true }));
    expect(r.pace).toEqual({ pi_per_week: 17.5, active_days: 4 });
    expect(JSON.stringify(r)).not.toMatch(/eta_days|entries/);
  });

  it('Life said "not projectable" → no pace. A refusal stays a refusal; the gap is never filled', () => {
    expect(lifeContextToAi(served({ trajectory: { pi_per_week: 0, active_days: 1, projectable: false } }, { TRAJECTORY: true })).pace).toBeUndefined();
    expect(lifeContextToAi(served({ trajectory: { pi_per_week: 5, active_days: 2 } }, { TRAJECTORY: true })).pace).toBeUndefined(); // no verdict → no pace
  });

  it('a pace with a non-number, a negative or an infinite figure is no pace', () => {
    for (const t of [
      { projectable: true, pi_per_week: 'lots', active_days: 2 },
      { projectable: true, pi_per_week: -1, active_days: 2 },
      { projectable: true, pi_per_week: Infinity, active_days: 2 },
      { projectable: true, pi_per_week: 3 },
    ]) expect(lifeContextToAi(served({ trajectory: t })).pace).toBeUndefined();
  });

  it('garbage is still an empty context, never a throw', () => {
    for (const v of [null, 'x', { data: { context: { skills: 'x', trajectory: 'y' } } }]) {
      const r = lifeContextToAi(v);
      expect(r.skills).toBeUndefined();
      expect(r.pace).toBeUndefined();
    }
  });
});

describe('the signed context carries them and re-narrows them on the way out', () => {
  it('round-trips skills and pace for the right user', async () => {
    const claims = { kycVerified: true, goals: [], skills: [{ name: 'Design', level: 'EXPERT' as const }], pace: { pi_per_week: 17.5, active_days: 4 } };
    const token  = await signContext(claims, 'user-1', SECRET);
    expect(await verifyContext(token, 'user-1', SECRET)).toEqual(claims);
  });

  it('a token with a numeric level or a malformed pace comes out without them', async () => {
    const loose = await new SignJWT({ ctx: { kycVerified: true, goals: [], skills: [{ name: 'X', level: 9 }, { name: 'Y', level: 'EXPERT' }], pace: { pi_per_week: 'fast' } } })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('user-1').setIssuer('tec.hub').setAudience('tec-ai-context')
      .setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(SECRET));
    const out = await verifyContext(loose, 'user-1', SECRET);
    expect(out?.skills).toEqual([{ name: 'Y', level: 'EXPERT' }]);
    expect(out?.pace).toBeUndefined();
  });
});

describe('the route and the prompt', () => {
  const bff  = read('src/app/api/bff/ai/context/route.ts');
  const chat = read('src/app/api/ai/chat/route.ts');

  it('the BFF carries what the door served — and only when it did', () => {
    expect(bff).toMatch(/if \(life\.skills\) out\.skills = life\.skills/);
    expect(bff).toMatch(/if \(life\.pace\)\s+out\.pace\s+= life\.pace/);
    expect(bff).toMatch(/skills:\s+c\.skills/);
    expect(bff).toMatch(/pace:\s+c\.pace/);
    // Still one read of the door, as tec-app-ai, and never the tables.
    expect(bff).toContain("'x-service-name': 'tec-app-ai'");
    expect(bff).not.toMatch(/\/api\/identity\/life\/(skills|trajectory|goals|preferences)/);
  });

  it('the prompt states the two rules: route toward a skill, never grade it; encourage a pace, never judge; no number the context does not hold', () => {
    expect(chat).toContain('a ladder — never a score');
    expect(chat).toMatch(/encourage, never judge/);
    expect(chat).toMatch(/NEVER state a\s+number this context does not hold/);
    expect(chat).toMatch(/not a prediction and not advice/);
  });

  it('the prompt lines come from the verified claims, and are empty when absent', () => {
    expect(chat).toMatch(/const skills = \(userContext\?\.skills \?\? \[\]\)\.slice\(0, 5\)/);
    expect(chat).toMatch(/const p = userContext\?\.pace;/);
    expect(chat).toMatch(/skills\.length\s*\?/);
    expect(chat).toMatch(/\$\{skillsLine\}\n\$\{paceLine\}/);
  });
});
