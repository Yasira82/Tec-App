/**
 * A session already open on a duplicate account moves to the Pioneer's oldest without
 * the person signing out (owner, 2026-10-09: three sign-outs, still 5π — none reached
 * the server). Once per tab; nothing happens when the account is already the right one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureCanonicalAccount } from '@/lib-client/pi/account-check';
import { tecSession } from '@/lib-client/pi/tec-session';

const answer = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);

beforeEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('ensureCanonicalAccount', () => {
  it('moved to another account → the in-memory session is dropped and the page reloads', async () => {
    vi.stubGlobal('fetch', answer({ token: 't', accountId: 'acct-oldest' }));
    tecSession.set('old-token', { id: 'acct-dup' } as never);
    const reload = vi.fn();
    expect(await ensureCanonicalAccount('acct-dup', reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(tecSession.token).toBeNull();
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/auth/refresh');
  });

  it('same account → nothing happens', async () => {
    vi.stubGlobal('fetch', answer({ token: 't', accountId: 'acct-oldest' }));
    const reload = vi.fn();
    expect(await ensureCanonicalAccount('acct-oldest', reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('once per tab: a second call does not even ask', async () => {
    const f = answer({ accountId: 'acct-oldest' });
    vi.stubGlobal('fetch', f);
    const reload = vi.fn();
    await ensureCanonicalAccount('acct-dup', reload);
    expect(await ensureCanonicalAccount('acct-dup', reload)).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('refresh refused, no accountId, a network error, or no user → nothing happens', async () => {
    const reload = vi.fn();
    vi.stubGlobal('fetch', answer({}, false));
    expect(await ensureCanonicalAccount('a', reload)).toBe(false);
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', answer({ token: 't' }));
    expect(await ensureCanonicalAccount('a', reload)).toBe(false);
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await ensureCanonicalAccount('a', reload)).toBe(false);
    expect(await ensureCanonicalAccount(null, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('the refresh route says which account the session belongs to', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/auth/refresh/route.ts'), 'utf8');
    expect(route).toMatch(/NextResponse\.json\(\{ token: newAccessToken, accountId \}\)/);
  });

  it('every sign-out waits for the server before leaving the page', () => {
    for (const f of ['src/app/hub/profile/page.tsx', 'src/app/dashboard/profile/page.tsx', 'src/app/dashboard/layout.tsx', 'src/app/hub/campaign/page.tsx']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      expect(src, f).toMatch(/await logout\(\); router\.push\('\/'\)/);
      expect(src, f).not.toMatch(/\{ logout\(\); router\.push/);
    }
  });
});
