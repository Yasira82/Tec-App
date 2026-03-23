'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────
export type TxType   = 'send' | 'receive' | 'payment';
export type TxStatus = 'completed' | 'pending' | 'failed';

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
  txHash?:   string;   // ← الـ page بتستخدم txHash
  createdAt: string;
}

// ← الـ page بتستخدم wallet object مش balance مباشرة
export interface WalletInfo {
  balance:  number;
  currency: string;
  address?: string;
}

interface UseWalletReturn {
  wallet:        WalletInfo | null;
  transactions:  Transaction[];
  total:         number;
  totalPages:    number;             // ← الـ page بتستخدمه
  page:          number;
  hasMore:       boolean;
  isLoading:     boolean;
  isRefreshing:  boolean;
  error:         string | null;
  filterType:    TxType | 'all';
  filterStatus:  TxStatus | 'all';
  setFilterType:   (v: TxType | 'all')   => void;
  setFilterStatus: (v: TxStatus | 'all') => void;
  refetch:       () => void;          // ← الـ page بتستخدم refetch
  loadMore:      () => void;
  setPage:       (p: number) => void;
  updateBalance: (b: number) => void;
}

const GATEWAY  = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;
const PAGE_SIZE = 10;

// ─── Hook ──────────────────────────────────────────────────────
export function useWallet(): UseWalletReturn {
  const [wallet,        setWallet]        = useState<WalletInfo | null>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPageState]     = useState(1);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [filterType,    setFilterType]    = useState<TxType | 'all'>('all');
  const [filterStatus,  setFilterStatus]  = useState<TxStatus | 'all'>('all');

  const abortRef = useRef<AbortController | null>(null);

  // ── helpers ─────────────────────────────────────────────────
  const getToken = (): string | null =>
    typeof window !== 'undefined'
      ? localStorage.getItem('tec_access_token')
      : null;

  const getUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('tec_user');
      return raw ? (JSON.parse(raw)?.uid ?? null) : null;
    } catch { return null; }
  };

  // ── fetch ────────────────────────────────────────────────────
  const fetchAll = useCallback(async (
    targetPage: number,
    silent = false,
  ) => {
    const token  = getToken();
    const userId = getUserId();

    if (!token || !userId) {
      setIsLoading(false);
      setError('Not authenticated');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      // ── Balance ─────────────────────────────────────────────
      const balanceRes = await fetch(
        `/api/wallet/balance?userId=${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal:  ctrl.signal,
        },
      );
      if (!balanceRes.ok) throw new Error(`Balance error: ${balanceRes.status}`);
      const balanceData: { balance: number; currency: string; address?: string } =
        await balanceRes.json();

      // ── Transactions ─────────────────────────────────────────
      const params = new URLSearchParams({
        userId,
        page:  String(targetPage),
        limit: String(PAGE_SIZE),
        ...(filterType   !== 'all' && { type:   filterType }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const txRes = await fetch(
        `${GATEWAY}/payments/history?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal:  ctrl.signal,
        },
      );
      if (!txRes.ok) throw new Error(`Transactions error: ${txRes.status}`);
      const txData: { transactions: Transaction[]; total: number } =
        await txRes.json();

      // ── State update ─────────────────────────────────────────
      setWallet({
        balance:  balanceData.balance,
        currency: balanceData.currency,
        address:  balanceData.address,
      });
      setTransactions(txData.transactions);
      setTotal(txData.total);
      setPageState(targetPage);

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterType, filterStatus]);

  // ── Public actions ───────────────────────────────────────────
  const refetch  = useCallback(() => fetchAll(1, true),         [fetchAll]);
  const loadMore = useCallback(() => fetchAll(page + 1, true),  [fetchAll, page]);
  const setPage  = useCallback((p: number) => fetchAll(p),      [fetchAll]);

  // Live balance update من useWalletRealtime
  const updateBalance = useCallback((newBalance: number) => {
    setWallet(prev => prev ? { ...prev, balance: newBalance } : prev);
  }, []);

  // ── Auto-fetch ────────────────────────────────────────────────
  useEffect(() => {
    fetchAll(1);
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line

  // Filters change → reset to page 1
  useEffect(() => {
    fetchAll(1);
  }, [filterType, filterStatus]); // eslint-disable-line

  // ── Computed ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasMore    = page < totalPages;

  return {
    wallet,
    transactions,
    total,
    totalPages,
    page,
    hasMore,
    isLoading,
    isRefreshing,
    error,
    filterType,
    filterStatus,
    setFilterType,
    setFilterStatus,
    refetch,
    loadMore,
    setPage,
    updateBalance,
  };
                               }
