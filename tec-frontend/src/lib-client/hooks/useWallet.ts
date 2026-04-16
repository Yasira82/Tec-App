'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

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
  txHash?:   string;
  createdAt: string;
}

export interface WalletInfo {
  balance:   number;
  currency:  string;
  address?:  string;
  walletId?: string;  // ✅ UUID للـ internal transfer
}

interface UseWalletReturn {
  wallet:          WalletInfo | null;
  transactions:    Transaction[];
  total:           number;
  totalPages:      number;
  page:            number;
  hasMore:         boolean;
  isLoading:       boolean;
  isRefreshing:    boolean;
  error:           string | null;
  filterType:      TxType | 'all';
  filterStatus:    TxStatus | 'all';
  setFilterType:   (v: TxType | 'all')   => void;
  setFilterStatus: (v: TxStatus | 'all') => void;
  refetch:         () => void;
  loadMore:        () => void;
  setPage:         (p: number) => void;
  updateBalance:   (b: number) => void;
}

const PAGE_SIZE = 10;

export function useWallet(): UseWalletReturn {
  const [wallet,       setWallet]       = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPageState]    = useState(1);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [filterType,   setFilterType]   = useState<TxType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TxStatus | 'all'>('all');

  const abortRef = useRef<AbortController | null>(null);

  const getToken  = (): string | null => getAccessToken();
  const getUserId = (): string | null => {
    const user = getStoredUser() as { id?: string; uid?: string } | null;
    return user?.id ?? user?.uid ?? null;
  };

  const fetchAll = useCallback(async (targetPage: number, silent = false) => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) { setIsLoading(false); setError('Not authenticated'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      // ── Balance + walletId ──────────────────────────────
      const balanceRes = await fetch(`/api/wallet/balance?userId=${userId}`, {
        credentials: 'include',
        headers:     { Authorization: `Bearer ${token}` },
        signal:      ctrl.signal,
      });

      if (!balanceRes.ok) throw new Error(`Balance error: ${balanceRes.status}`);

      const balanceData: { balance: number; currency: string; address?: string; walletId?: string } =
        await balanceRes.json();

      setWallet({
        balance:  balanceData.balance,
        currency: balanceData.currency,
        address:  balanceData.address,
        walletId: balanceData.walletId,  // ✅
      });

      // ── Transactions ────────────────────────────────────
      try {
        const params = new URLSearchParams({
          userId,
          page:  String(targetPage),
          limit: String(PAGE_SIZE),
          ...(filterType   !== 'all' && { type:   filterType   }),
          ...(filterStatus !== 'all' && { status: filterStatus }),
        });

        const txRes = await fetch(`/api/payments/history?${params}`, {
          credentials: 'include',
          headers:     { Authorization: `Bearer ${token}` },
          signal:      ctrl.signal,
        });

        if (txRes.ok) {
          const txData: { transactions: Transaction[]; total: number } = await txRes.json();
          setTransactions(txData.transactions ?? []);
          setTotal(txData.total ?? 0);
        }
      } catch { /* transactions مش إلزامية */ }

      setPageState(targetPage);
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterType, filterStatus]);

  const refetch       = useCallback(() => fetchAll(1, true),        [fetchAll]);
  const loadMore      = useCallback(() => fetchAll(page + 1, true), [fetchAll, page]);
  const setPage       = useCallback((p: number) => fetchAll(p),     [fetchAll]);
  const updateBalance = useCallback((newBalance: number) => {
    setWallet(prev => prev ? { ...prev, balance: newBalance } : prev);
  }, []);

  useEffect(() => {
    fetchAll(1);
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line

  useEffect(() => { fetchAll(1); }, [filterType, filterStatus]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasMore    = page < totalPages;

  return {
    wallet, transactions, total, totalPages, page, hasMore,
    isLoading, isRefreshing, error,
    filterType, filterStatus, setFilterType, setFilterStatus,
    refetch, loadMore, setPage, updateBalance,
  };
    }
