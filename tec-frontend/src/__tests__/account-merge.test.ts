/**
 * Admin: merge a Pioneer's duplicate accounts (tec-core-backend #403). The BFF forwards
 * only the session token and { username, confirm }; the page merges only when the name
 * is typed again, and only after a dry run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('account-merge', () => {
  it('the BFFs send the session token only, to the right services', () => {
    const merge = read('src/app/api/admin/account-merge/route.ts');
    expect(merge).toContain('/api/commerce/admin/account-merge');
    expect(merge).toContain('/api/assets/admin/account-merge');
    // the service is picked from a fixed list, never a path from the caller
    expect(merge).toMatch(/Object\.hasOwn\(SERVICES, service\)/);
    expect(merge).toMatch(/JSON\.stringify\(\{ username, confirm \}\)/);
    const list = read('src/app/api/admin/duplicate-accounts/route.ts');
    expect(list).toContain('/api/auth/admin/duplicate-accounts');
    for (const src of [merge, list]) expect(src).not.toMatch(/'x-internal-key'\s*:/);
  });

  it('the page merges only what the dry run showed, with the name typed again', () => {
    const src = read('src/app/hub/admin/account-merge/page.tsx');
    expect(src).toMatch(/disabled=\{busy \|\| typed !== g\.username/);
    expect(src).toMatch(/if \(!plan \|\| !open \|\| typed !== open\) return/);
    expect(src).toMatch(/body: JSON\.stringify\(\{ username: open, confirm: typed \}\)/);
  });

  it('the Profile links to it', () => {
    expect(read('src/app/hub/profile/page.tsx')).toContain("router.push('/hub/admin/account-merge')");
  });
});
