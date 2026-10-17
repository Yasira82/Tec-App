/**
 * Admin: erase an account across services (tec-core-backend #437). The BFF forwards only the
 * session token and { username, confirm, ref }; the page erases only after a dry run of the same
 * name, with the name typed again and the request it answers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('account-erasure', () => {
  it('the BFF sends the session token only, to identity, with exactly three fields', () => {
    const src = read('src/app/api/admin/erasure/route.ts');
    expect(src).toContain('/api/identity/admin/erasure');
    expect(src).toContain('/preview?username=');
    expect(src).toMatch(/JSON\.stringify\(\{ username, confirm, ref \}\)/);
    expect(src).not.toMatch(/'x-internal-key'\s*:/);
  });

  it('the page erases only the dry-run name, typed again, with a reference', () => {
    const src = read('src/app/hub/admin/erasure/page.tsx');
    expect(src).toMatch(/if \(!plan \|\| typed !== plan\.username \|\| !ref\.trim\(\)\) return/);
    expect(src).toMatch(/disabled=\{busy \|\| typed !== plan\.username \|\| !ref\.trim\(\)\}/);
    expect(src).toMatch(/body: JSON\.stringify\(\{ username: plan\.username, confirm: typed, ref: ref\.trim\(\) \}\)/);
    // a name edited after the dry run drops the plan, so the erase button cannot outlive it
    expect(src).toMatch(/setName\(e\.target\.value\); setPlan\(null\)/);
  });

  it('the Profile links to it, in every language', () => {
    expect(read('src/app/hub/profile/page.tsx')).toContain("router.push('/hub/admin/erasure')");
    for (const l of ['en', 'ar', 'es', 'fr', 'pt', 'ru', 'tr', 'id', 'vi', 'hi', 'zh', 'ko']) {
      expect(read(`src/lib/i18n/${l}.ts`)).toMatch(/adminErase: '.+', adminEraseSub: '.+'/);
    }
  });
});
