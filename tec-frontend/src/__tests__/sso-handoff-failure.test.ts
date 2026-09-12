// @vitest-environment node
//
// The Hub's `/api/auth/sso` handoff is the ONLY way into every app in the
// fleet. Its failure path used to be `catch { return { error: 'sso_failed' } }`
// — one opaque answer for a malformed user cookie, an unsignable token, and a
// bad target URL alike.
//
// Commerce showed what that costs: its tile 500'd from the Hub while the very
// same app opened fine when typed directly, and there was nothing to read from
// a phone. Two rounds of guessing, because the one component that knew the
// answer had been written not to say it.
//
// A failure in a path with no alternative must name itself (C-96).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'src/app/api/auth/sso/route.ts'), 'utf8',
);

describe('the SSO handoff says why it failed', () => {
  it('does not swallow the error', () => {
    // The HANDOFF catch — the last one in the file, the one that owns the
    // response. `catch {` with no binding cannot report anything; that IS the
    // defect. The inner `} catch {` around jwtVerify stays: an expired token
    // there is the normal path to refresh, not a failure to explain.
    // Match the catch CLAUSE, not the word — the comment below it says
    // "catch" too, and `lastIndexOf('catch')` happily found that instead.
    const clauses = route.match(/\}\s*catch\s*(\(\w+\))?\s*\{/g) ?? [];
    expect(clauses.at(-1)).toMatch(/catch\s*\(\w+\)/);
    expect(route.slice(route.indexOf('const token = await new SignJWT')))
      .not.toMatch(/\}\s*catch\s*\{/);
  });

  it('returns a reason and the target that failed', () => {
    expect(route).toContain("error: 'sso_failed'");
    expect(route).toMatch(/reason:\s*reason\.slice/);
    expect(route).toMatch(/\btarget,/);
  });

  it('logs server-side as well, for whoever can read the logs', () => {
    expect(route).toContain("console.error('[sso] handoff failed'");
  });

  it('still fails with 500 — naming the cause is not forgiving it', () => {
    const tail = route.slice(route.indexOf('catch (err)'));
    expect(tail).toContain('status: 500');
  });

  it('bounds the reason, so a huge error cannot become the response body', () => {
    expect(route).toMatch(/reason\.slice\(0,\s*\d+\)/);
  });

  it('keeps the rejected-target 400 separate from the crash 500', () => {
    // An origin that is not allowlisted is a DIFFERENT answer from a crash, and
    // it already explains itself. Collapsing the two would hide both.
    expect(route).toContain("error: 'invalid_target'");
    expect(route).toContain('status: 400');
  });
});
