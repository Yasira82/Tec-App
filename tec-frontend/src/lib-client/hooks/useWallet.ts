'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────
export type TxType   = 'send' | 'receive' | 'payment' | 'all';
export type TxStatus = 'completed' | 'pending' | 'failed' | 'all';

export interface Transaction {
  id:        string;
  type:      TxType;
  status:    TxStatus;
  amount:    number;
  currency:  string;
  from?:     string;
  to?:       string;
  memo?:     string;
  txId?:     string;
  createdAt: string;
}

export interface WalletState {
  balance:      number;
  currency:     string;
  transactions: Transaction[];
  total:        number;
  page:         number;
  hasMore:      boolean;
  isLoading:    boolean;
  isRefreshing: boolean;
  error:        string | null;
}

interface UseWalletOptions {
  pageSize?:  number;
  autoFetch?: boolean;
}

// ─── Constants ────────────────────────────────────────────────
const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;
// = https://api-gateway-production-6a68.up.railway.app

// ─── Hook ─────────────────────────────────────────────────────
export function useWallet(options: UseWalletOptions = {}) {
  const { pageSize = 10, autoFetch = true } = options;

  const [state, setState] = useState<WalletState>({
    balance:      0,
    currency:     'PI',
    transactions: [],
    total:        0,
    page:         1,
    hasMore:      false,
    isLoading:    true,
    isRefreshing: false,
    error:        null,
  });

  const [filterType,   setFilterType]   = useState<TxType>('all');
  const [filterStatus, setFilterStatus] = useState<TxStatus>('all');

  const abortRef = useRef<AbortController | null>(null);

  // ── Auth token ────────────────────────────────────────────
  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tec_access_token');
  }, []);

  const getUserId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('tec_user');
      if (!raw) return null;
      return JSON.parse(raw)?.uid ?? null;
    } catch {
      return null;
    }
  }, []);

  // ── Fetch balance ─────────────────────────────────────────
  const fetchBalance = useCallback(async (
    token: string,
    userId: string,
    signal: AbortSignal,
  ): Promise<{ balance: number; currency: string }> => {
    // مرور على Next.js API Route (تتحقق من Token وتمرر للـ Gateway)
    const res = await fetch(
      `/api/wallet/balance?userId=${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      },
    );
    if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
    return res.json();
  }, []);

  // ── Fetch transactions ────────────────────────────────────
  const fetchTransactions = useCallback(async (
    token: string,
    userId: string,
    page: number,
    signal: AbortSignal,
  ) => {
    const params = new URLSearchParams({
      userId,
      page:     String(page),
      limit:    String(pageSize),
      ...(filterType   !== 'all' && { type:   filterType }),
      ...(filterStatus !== 'all' && { status: filterStatus }),
    });

    const res = await fetch(
      `${GATEWAY}/payments/history?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      },
    );
    if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
    return res.json() as Promise<{
      transactions: Transaction[];
      total:        number;
    }>;
  }, [pageSize, filterType, filterStatus]);

  // ── Main fetch (parallel) ─────────────────────────────────
  const fetchAll = useCallback(async (
    page = 1,
    silent = false,
  ) => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) {
      setState(s => ({ ...s, isLoading: false, error: 'Not authenticated' }));
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState(s => ({
      ...s,
      isLoading:    !silent,
      isRefreshing: silent,
      error:        null,
    }));

    try {
      const [balanceData, txData] = await Promise.all([
        fetchBalance(token, userId, ctrl.signal),
        fetchTransactions(token, userId, page, ctrl.signal),
      ]);

      setState(s => ({
        ...s,
        balance:      balanceData.balance,
        currency:     balanceData.currency,
        transactions: txData.transactions,
        total:        txData.total,
        page,
        hasMore:      page * pageSize < txData.total,
        isLoading:    false,
        isRefreshing: false,
        error:        null,
      }));
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setState(s => ({
        ...s,
        isLoading:    false,
        isRefreshing: false,
        error:        (err as Error).message ?? 'Unknown error',
      }));
    }
  }, [fetchBalance, fetchTransactions, getToken, getUserId, pageSize]);

  // ── Public actions ────────────────────────────────────────
  const refresh    = useCallback(() => fetchAll(1, true),  [fetchAll]);
  const loadMore   = useCallback(() => fetchAll(state.page + 1, true), [fetchAll, state.page]);
  const setPage    = useCallback((p: number) => fetchAll(p), [fetchAll]);

  // ── Live balance update (called by useWalletRealtime) ─────
  const updateBalance = useCallback((newBalance: number) => {
    setState(s => ({ ...s, balance: newBalance }));
  }, []);

  // ── Auto-fetch on mount + filter change ───────────────────
  useEffect(() => {
    if (autoFetch) fetchAll(1);
    return () => abortRef.current?.abort();
  }, [autoFetch, fetchAll]);

  // filters change → reset to page 1
  useEffect(() => {
    if (autoFetch) fetchAll(1);
  }, [filterType, filterStatus]); // eslint-disable-line

  return {
    ...state,
    filterType,
    filterStatus,
    setFilterType,
    setFilterStatus,
    refresh,
    loadMore,
    setPage,
    updateBalance,
  };
}
