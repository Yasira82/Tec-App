'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth, getStoredUser } from '@/lib-client/pi/pi-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType   = 'credit' | 'debit' | 'send' | 'receive' | 'payment';
export type TxStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export interface Transaction {
  id:         string;
  type:       TxType;
  amount:     number;
  currency:   string;
  status:     TxStatus;
  memo:       string;
  txHash?:    string;
  createdAt:  string;
}

export interface Wallet {
  id:         string;
  userId:     string;
  balance:    number;
  currency:   string;
  isPrimary:  boolean;
  address?:   string;
}

interface WalletState {
  wallet:       Wallet | null;
  transactions: Transaction[];
  isLoading:    boolean;
  isRefreshing: boolean;
  error:        string | null;
  page:         number;
  totalPages:   number;
  filterType:   TxType   | 'all';
  filterStatus: TxStatus | 'all';
}

interface UseWalletReturn extends WalletState {
  refetch:       () => Promise<void>;
  setPage:       (p: number) => void;
  setFilterType:   (t: TxType   | 'all') => void;
  setFilterStatus: (s: TxStatus | 'all') => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL
  ?? 'https://api-gateway-production-6a68.up.railway.app';

const LIMIT = 10;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWallet(): UseWalletReturn {
  const user = getStoredUser();

  const [state, setState] = useState<WalletState>({
    wallet:       null,
    transactions: [],
    isLoading:    true,
    isRefreshing: false,
    error:        null,
    page:         1,
    totalPages:   1,
    filterType:   'all',
    filterStatus: 'all',
  });

  // Prevent stale closures on refetch
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchWallet = useCallback(async (silent = false) => {
    if (!user?.id) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Silent refresh (background) vs full load
    setState(prev => ({
      ...prev,
      isLoading:    !silent,
      isRefreshing: silent,
      error:        null,
    }));

    try {
      const { page, filterType, filterStatus } = stateRef.current;

      // Build transactions query
      const txParams = new URLSearchParams({
        userId: user.id,
        limit:  String(LIMIT),
        page:   String(page),
        ...(filterType   !== 'all' && { type:   filterType }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      // Fetch balance + transactions in parallel
      const [balRes, txRes] = await Promise.all([
        fetch(`/api/wallet/balance?userId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('tec_access_token') ?? ''}` },
          cache: 'no-store',
        }),
        fetchWithAuth(`${GATEWAY}/api/payments/history?${txParams}`),
      ]);

      // ── Balance ──
      let wallet: Wallet | null = null;
      if (balRes.ok) {
        const balData = await balRes.json();
        wallet = {
          id:        user.id,
          userId:    user.id,
          balance:   balData.balance ?? 0,
          currency:  'PI',
          isPrimary: true,
          address:   balData.address,
        };
      }

      // ── Transactions ──
      let transactions: Transaction[] = [];
      let totalPages = 1;
      if (txRes.ok) {
        const txData = await txRes.json();
        const raw = txData?.data?.payments ?? txData?.payments ?? txData?.data ?? [];
        totalPages = txData?.data?.totalPages ?? txData?.totalPages ?? 1;

        transactions = raw.map((p: any): Transaction => ({
          id:        p.id ?? p._id,
          type:      p.type ?? (p.payment_method === 'receive' ? 'receive' : 'payment'),
          amount:    p.amount,
          currency:  p.currency ?? 'PI',
          status:    p.status,
          memo:      p.memo ?? p.payment_method ?? '',
          txHash:    p.txHash ?? p.tx_hash,
          createdAt: p.createdAt ?? p.created_at,
        }));
      }

      setState(prev => ({
        ...prev,
        wallet,
        transactions,
        totalPages,
        isLoading:    false,
        isRefreshing: false,
        error:        null,
      }));

    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading:    false,
        isRefreshing: false,
        error: err?.message ?? 'فشل في جلب بيانات المحفظة',
      }));
    }
  }, [user?.id]);

  // Refetch when page or filters change
  useEffect(() => {
    fetchWallet();
  }, [fetchWallet, state.page, state.filterType, state.filterStatus]);

  const setPage = useCallback((p: number) => {
    setState(prev => ({ ...prev, page: p }));
  }, []);

  const setFilterType = useCallback((t: TxType | 'all') => {
    setState(prev => ({ ...prev, filterType: t, page: 1 }));
  }, []);

  const setFilterStatus = useCallback((s: TxStatus | 'all') => {
    setState(prev => ({ ...prev, filterStatus: s, page: 1 }));
  }, []);

  // ✅ memoized عشان مش يسبب WebSocket reconnect على كل render
  const refetch = useCallback(() => fetchWallet(true), [fetchWallet]);

  return {
    ...state,
    refetch,
    setPage,
    setFilterType,
    setFilterStatus,
  };
}
