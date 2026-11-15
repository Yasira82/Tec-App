import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * TEC-AUDIT-0028 — when the balance loads and the history does not, the wallet must say
 * the history could not be loaded. It used to swallow the failure and show
 * "No transactions yet", a false statement about money, with nothing reported.
 */
const bffFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/bff-client', () => ({ bffFetch }));
vi.mock('@/lib-client/pi/session-source', () => ({ sessionUserId: () => 'u-1' }));
const reportError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({ reportError }));

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

afterEach(() => { vi.clearAllMocks(); });

describe('useWallet: a failed history is not an empty history', () => {
  it('marks txError and reports when the history request fails', async () => {
    bffFetch.mockImplementation(async (url: string) =>
      url.includes('/wallet/balance') ? json({ balance: '5', currency: 'PI' }) : json({}, 502));
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.wallet?.balance).toBe(5);
    expect(result.current.txError).toBe(true);
    expect(result.current.transactions).toEqual([]);
    expect(reportError).toHaveBeenCalled();
  });

  it('a history that loads empty is just empty', async () => {
    bffFetch.mockImplementation(async (url: string) =>
      url.includes('/wallet/balance') ? json({ balance: '5', currency: 'PI' }) : json({ transactions: [], total: 0 }));
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.txError).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });
});
