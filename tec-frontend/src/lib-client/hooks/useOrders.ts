'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

export type OrderStatus =
  | 'PENDING' | 'PAID' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  id:         string;
  product_id: string;
  quantity:   number;
  price:      number;
  currency:   string;
  snapshot:   { title: string; image_url?: string; seller_id: string } | null;
}

export interface Order {
  id:            string;
  buyer_id:      string;
  status:        OrderStatus;
  total:         number;
  currency:      string;
  payment_id:    string | null;
  notes:         string | null;
  created_at:    string;
  updated_at:    string;
  paid_at:       string | null;
  cancelled_at:  string | null;
  cancel_reason: string | null;
  items:         OrderItem[];
}

interface UseOrdersReturn {
  orders:          Order[];
  total:           number;
  totalPages:      number;
  page:            number;
  isLoading:       boolean;
  isRefreshing:    boolean;
  error:           string | null;
  filterStatus:    OrderStatus | 'all';
  setFilterStatus: (s: OrderStatus | 'all') => void;
  refetch:         () => void;
  setPage:         (p: number) => void;
}

const PAGE_SIZE = 10;

export function useOrders(): UseOrdersReturn {
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPageState]    = useState(1);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');

  const abortRef = useRef<AbortController | null>(null);

  // ✅ VM-004: cookie بدل localStorage
  const getToken = (): string | null => getAccessToken();

  const getUserId = (): string | null => {
    const user = getStoredUser() as { id?: string; uid?: string } | null;
    return user?.id ?? user?.uid ?? null;
  };

  const fetchOrders = useCallback(async (targetPage: number, silent = false) => {
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
      const params = new URLSearchParams({
        buyer_id: userId,
        page:     String(targetPage),
        limit:    String(PAGE_SIZE),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const res = await fetch(`/api/commerce/orders?${params}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-id':   userId,
        },
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`);
      const data: { success: boolean; data: { orders: Order[]; total: number } } =
        await res.json();

      setOrders(data.data.orders ?? []);
      setTotal(data.data.total ?? 0);
      setPageState(targetPage);
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterStatus]);

  const refetch = useCallback(() => fetchOrders(1, true), [fetchOrders]);
  const setPage = useCallback((p: number) => fetchOrders(p), [fetchOrders]);

  useEffect(() => {
    fetchOrders(1);
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line

  useEffect(() => { fetchOrders(1); }, [filterStatus]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    orders, total, totalPages, page,
    isLoading, isRefreshing, error,
    filterStatus, setFilterStatus,
    refetch, setPage,
  };
}
