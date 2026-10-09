/**
 * A session on a duplicate account is moved to the Pioneer's oldest at refresh
 * (tec-core-backend); the Hub's tec_user follows it, and nothing else changes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withAccountId } from '@/lib/auth/account-id';

const u = JSON.stringify({ id: 'acct-dup', piUsername: 'yas55eR82', kycVerified: true });

describe('withAccountId', () => {
  it('a moved session → the cookie carries the new id, every other field as it was', () => {
    expect(JSON.parse(withAccountId(u, 'acct-oldest')!)).toEqual({ id: 'acct-oldest', piUsername: 'yas55eR82', kycVerified: true });
  });

  it('same id, no id from auth, a broken cookie, or no cookie → returned untouched', () => {
    expect(withAccountId(u, 'acct-dup')).toBe(u);
    expect(withAccountId(u, undefined)).toBe(u);
    expect(withAccountId('{not json', 'acct-oldest')).toBe('{not json');
    expect(withAccountId(undefined, 'acct-oldest')).toBeUndefined();
  });

  it('the refresh route uses it on the user auth-service returned', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/auth/refresh/route.ts'), 'utf8');
    expect(route).toMatch(/withAccountId\(req\.cookies\.get\('tec_user'\)\?\.value, data\.user\?\.id/);
  });
});
