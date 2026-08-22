'use client';

import { useState } from 'react';
import { useOrders, Order, OrderStatus } from '@/lib-client/hooks/useOrders';
import styles from './orders.module.css';
import { useTranslation, errorText } from '@/lib/i18n';

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ✅ Number() — يتعامل مع Decimal string من الـ DB
function formatAmount(amount: number | string, currency: string) {
  return `${Number(amount).toFixed(2)} ${currency === 'PI' ? 'π' : currency}`;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; css: string }> = {
  PENDING:    { label: 'Pending',    css: 'statusPending'    },
  PAID:       { label: 'Paid',       css: 'statusPaid'       },
  PROCESSING: { label: 'Processing', css: 'statusProcessing' },
  SHIPPED:    { label: 'Shipped',    css: 'statusShipped'    },
  DELIVERED:  { label: 'Delivered',  css: 'statusDelivered'  },
  CANCELLED:  { label: 'Cancelled',  css: 'statusCancelled'  },
  REFUNDED:   { label: 'Refunded',   css: 'statusRefunded'   },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`${styles.statusBadge} ${styles[cfg.css]}`}>
      {cfg.label}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────
export default function OrdersPage() {
  const { t } = useTranslation();
  const {
    orders, isLoading, isRefreshing, error,
    page, totalPages, total,
    filterStatus, setFilterStatus,
    refetch, setPage,
  } = useOrders();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <OrdersSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span>⚠️</span>
          <p>{errorText(t, error)}</p>
          <button className={styles.btn} onClick={refetch}>إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.subtitle}>
            {total > 0 ? `${total} order${total !== 1 ? 's' : ''}` : 'No orders yet'}
          </p>
        </div>
        <div className={styles.headerRight}>
          {isRefreshing && <span className={styles.refreshing}>⟳ Refreshing...</span>}
          <button className={styles.btn} onClick={refetch}>↻ Refresh</button>
        </div>
      </header>

      {/* ── Filters ── */}
      <div className={`${styles.filtersBar} fade-up`}>
        {(['all', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const).map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${filterStatus === s ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterStatus(s as OrderStatus | 'all')}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s as OrderStatus].label}
          </button>
        ))}
      </div>

      {/* ── Orders List ── */}
      <section className={`${styles.ordersList} fade-up-1`}>
        {orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(
                expandedId === order.id ? null : order.id
              )}
            />
          ))
        )}
      </section>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.paginationBtn}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className={styles.paginationInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.paginationBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}

// ─── OrderCard ─────────────────────────────────────────────────
function OrderCard({
  order, expanded, onToggle,
}: {
  order:    Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${styles.orderCard} ${expanded ? styles.orderCardExpanded : ''}`}>
      {/* ── Summary Row ── */}
      <div className={styles.orderSummary} onClick={onToggle}>
        <div className={styles.orderLeft}>
          <div className={styles.orderId}>
            #{order.id.slice(0, 8).toUpperCase()}
          </div>
          <div className={styles.orderDate}>{formatDate(order.created_at)}</div>
        </div>

        <div className={styles.orderCenter}>
          <div className={styles.orderItems}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </div>
          {order.items[0]?.snapshot?.title && (
            <div className={styles.orderFirstItem}>
              {order.items[0].snapshot.title}
              {order.items.length > 1 && ` +${order.items.length - 1} more`}
            </div>
          )}
        </div>

        <div className={styles.orderRight}>
          <div className={styles.orderTotal}>
            {formatAmount(order.total, order.currency)}
          </div>
          <StatusBadge status={order.status} />
        </div>

        <span className={`${styles.expandIcon} ${expanded ? styles.expandIconOpen : ''}`}>
          ›
        </span>
      </div>

      {/* ── Expanded Details ── */}
      {expanded && (
        <div className={styles.orderDetails}>
          {/* Items */}
          <div className={styles.detailSection}>
            <div className={styles.detailTitle}>Items</div>
            {order.items.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>
                    {item.snapshot?.title ?? 'Product'}
                  </span>
                  <span className={styles.itemQty}>× {item.quantity}</span>
                </div>
                <span className={styles.itemPrice}>
                  {/* ✅ Number() — يتعامل مع Decimal */}
                  {formatAmount(Number(item.price) * item.quantity, item.currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className={styles.detailMeta}>
            {order.payment_id && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Payment ID</span>
                <span className={styles.metaValue}>
                  {order.payment_id.slice(0, 16)}...
                </span>
              </div>
            )}
            {order.paid_at && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Paid at</span>
                <span className={styles.metaValue}>{formatDate(order.paid_at)}</span>
              </div>
            )}
            {order.cancel_reason && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Cancel reason</span>
                <span className={styles.metaValue}>{order.cancel_reason}</span>
              </div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Total</span>
              <span className={`${styles.metaValue} ${styles.metaTotal}`}>
                {formatAmount(order.total, order.currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className={styles.emptyState}>
      <span>🛒</span>
      <p>No orders yet</p>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader} />
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.skeletonCard} />
      ))}
    </div>
  );
}
