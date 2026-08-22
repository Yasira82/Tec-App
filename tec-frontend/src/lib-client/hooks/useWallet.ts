'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionToken, sessionUserId } from '@/lib-client/pi/session-source';
import { bffFetch } from '@/lib-client/pi/bff-client';

/** Sentinel, not prose: a hook has no locale. The page maps it to the reader's
 *  language — this string used to reach the screen as English inside Arabic. */
export const NOT_AUTHENTICATED = 'NOT_AUTHENTICATED';

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
  walletId?: string;
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

// ✅ map wallet service transaction → Transaction interface
interface RawWalletTx {
  id:          string;
  type:        string;
  status:      string;
  amount:      number | string;
  currency:    string;
  created_at:  string;
  description?: string;
  metadata?:   { direction?: string; counterpartyWalletId?: string };
}

function mapWalletTx(tx: RawWalletTx): Transaction {
  const dir = tx.metadata?.direction;
  // Normalise: the wallet ledger writes payment credits as type 'CREDIT' (uppercase)
  // — without this they fell through to the 'payment' default and rendered as a RED
  // NEGATIVE row, so a genuine incoming credit looked like money leaving. Lower-case
  // + treat 'credit'/'deposit' as an incoming (green, +) 'receive'.
  const t = (tx.type ?? '').toLowerCase();
  let type: TxType = 'payment';
  if (dir === 'credit' || t === 'deposit' || t === 'credit')      type = 'receive';
  else if (dir === 'debit' || t === 'withdrawal')                 type = 'send';
  else if (t === 'transfer') type = dir === 'credit' ? 'receive' : 'send';

  return {
    id:        tx.id,
    type,
    status:    (tx.status as TxStatus) ?? 'completed',
    amount:    Number(tx.amount),
    currency:  tx.currency,
    createdAt: tx.created_at,
    memo:      tx.description ?? undefined,
  };
}

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


  const fetchAll = useCallback(async (targetPage: number, silent = false) => {
    const token  = sessionToken();
    const userId = sessionUserId();
    if (!token || !userId) { setIsLoading(false); setError(NOT_AUTHENTICATED); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      // ── Balance + walletId ──────────────────────────────
      const balanceRes = await bffFetch('/api/bff/wallet/balance', { signal: ctrl.signal });

      if (!balanceRes.ok) throw new Error(`Balance error: ${balanceRes.status}`);

      const balanceData: {
        balance: number | string; currency: string; address?: string; walletId?: string;
      } = await balanceRes.json();

      // ✅ ADR-009: API returns Pi amounts as STRINGS (DECIMAL in DB → string in API).
      // Coerce to a finite number here so the UI (.toFixed) never crashes (NEW-P).
      const numBalance = Number(balanceData.balance);
      setWallet({
        balance:  Number.isFinite(numBalance) ? numBalance : 0,
        currency: balanceData.currency,
        address:  balanceData.address,
        walletId: balanceData.walletId,
      });

      // ── Wallet Transactions (internal transfers + deposits) ──
      try {
        if (balanceData.walletId) {
          const params = new URLSearchParams({
            walletId: balanceData.walletId,
            page:     String(targetPage),
            limit:    String(PAGE_SIZE),
            ...(filterStatus !== 'all' && { status: filterStatus }),
          });

          const txRes = await bffFetch(`/api/bff/wallet/transactions?${params}`, {
            credentials: 'include',
            signal:      ctrl.signal,
          });

          if (txRes.ok) {
            const txData = await txRes.json();
            const rawTxs: RawWalletTx[] =
              txData?.data?.transactions ?? txData?.transactions ?? [];

            // ✅ filter by type if needed
            let mapped = rawTxs.map(mapWalletTx);
            if (filterType !== 'all') {
              mapped = mapped.filter(tx => tx.type === filterType);
            }

            setTransactions(mapped);
            setTotal(txData?.data?.pagination?.total ?? mapped.length);
            setPageState(targetPage);
            return;
          }
        }

        // ── Fallback: payment history ───────────────────
        const params = new URLSearchParams({
          userId,
          page:  String(targetPage),
          limit: String(PAGE_SIZE),
          ...(filterType   !== 'all' && { type:   filterType   }),
          ...(filterStatus !== 'all' && { status: filterStatus }),
        });

        const txRes = await bffFetch(`/api/bff/payments/history?${params}`, {
          credentials: 'include',
          signal:      ctrl.signal,
        });

        if (txRes.ok) {
          const txData: { transactions: (Transaction & { amount: number | string })[]; total: number } = await txRes.json();
          // ✅ ADR-009: coerce amounts to numbers here too (fallback history path).
          const list = (txData.transactions ?? []).map(t => ({ ...t, amount: Number(t.amount) }));
          setTransactions(list);
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
    // ✅ Realtime payloads may also carry the balance as a string — coerce.
    const n = Number(newBalance);
    setWallet(prev => prev ? { ...prev, balance: Number.isFinite(n) ? n : prev.balance } : prev);
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
