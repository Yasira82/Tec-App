/**
 * The Quest and campaign links resolve to their signed version when there is
 * one, and to the plain app link otherwise (C-123 §12) — the worst case is the
 * behaviour before the links existed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useHandoffLinks } from '@/lib-client/handoff-links';

const A = 'https://dx.tecosystem.app/?q=1';
const B = 'https://alert.tecosystem.app/?q=1';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('useHandoffLinks', () => {
  it('uses the signed link once it arrives, and the plain link for anything it did not sign', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ links: { [A]: 'https://dx.tecosystem.app/api/auth/sso-callback?token=t1' } })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHandoffLinks([A, B], true));
    await waitFor(() => expect(result.current(A)).toContain('sso-callback'));
    expect(result.current(B)).toBe(B);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ targets: [A, B] });
    expect(init.method).toBe('POST');
  });

  it('asks for nothing when the visitor is not signed in to the Hub', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHandoffLinks([A], false));
    expect(result.current(A)).toBe(A);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the plain link when the Hub fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const { result } = renderHook(() => useHandoffLinks([A], true));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current(A)).toBe(A);
  });

  it('a tapped link is spent: it is dropped and a fresh set is fetched', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ links: { [A]: `https://dx.tecosystem.app/api/auth/sso-callback?token=t${++n}` } })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHandoffLinks([A], true));
    await waitFor(() => expect(result.current(A)).toContain('token=t1'));
    act(() => result.current.spent(A));
    expect(result.current(A)).toBe(A);
    await waitFor(() => expect(result.current(A)).toContain('token=t2'), { timeout: 3000 });
  });
});
