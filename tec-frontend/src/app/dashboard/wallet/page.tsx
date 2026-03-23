'use client';

import { useState, useCallback } from 'react';
import { useWallet, TxType, TxStatus, Transaction } from '@/lib-client/hooks/useWallet';
import { useWalletRealtime, WalletUpdatedEvent } from '@/lib-client/hooks/useWalletRealtime';
import styles from './wallet.module.css';

// ─── Helpers ──────────────────────────────────────────────────
function getTypeIcon(type: string) {
  switch (type) {
    case 'receive':
    case 'credit':  return '↓';
    case 'send':
    case 'debit':   return '↑';
    case 'payment': return '→';
    default:        return '•';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isPositive(type: string) {
  return type === 'receive' || type === 'credit';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: styles.statusCompleted,
    pending:   styles.statusPending,
    failed:    styles.statusFailed,
    cancelled: styles.statusFailed,
  };
  return (
    <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────
export default function WalletPage() {
  const {
    wallet,
    transactions,
    isLoading,
    isRefreshing,
    error,
    page,
    totalPages,
    filterType,
    filterStatus,
    refetch,
    setPage,
    setFilterType,
    setFilterStatus,
    updateBalance,
  } = useWallet();

  const [liveFlash, setLiveFlash] = useState(false);

  // ← الـ callback بيستقبل الـ full event زي ما الـ page كانت بتتوقع
  const handleBalanceUpdate = useCallback((event: WalletUpdatedEvent) => {
    updateBalance(event.balance); // ← بندّي الـ hook يحدّث الـ wallet object

    setLiveFlash(true);
    setTimeout(() => setLiveFlash(false), 1000);

    // Refresh list بعد أي تحديث على الـ balance
    refetch();
  }, [updateBalance, refetch]);

  const { isConnected } = useWalletRealtime({
    onBalanceUpdate: handleBalanceUpdate,
  });

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.container}>
        <WalletSkeleton />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span>⚠️</span>
          <p>{error}</p>
          <button className={styles.actionBtn} onClick={refetch}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const displayBalance = wallet?.balance ?? null;

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Wallet</h1>
          <p className={styles.subtitle}>Manage your Pi balance and transactions</p>
        </div>
        <div className={styles.headerRight}>
          <div className={`${styles.liveIndicator} ${isConnected ? styles.liveOn : styles.liveOff}`}>
            <span className={styles.liveDot} />
            {isConnected ? 'Live' : 'Offline'}
          </div>
          {isRefreshing && (
            <span className={styles.refreshing}>⟳ جاري التحديث...</span>
          )}
        </div>
      </header>

      {/* ── Balance Card ── */}
      <section className={`${styles.balanceCard} fade-up`}>
        <div className={styles.balanceLabel}>Total Balance</div>
        <div className={`${styles.balanceAmount} gold-text ${liveFlash ? styles.balanceFlash : ''}`}>
          {displayBalance != null ? `${displayBalance.toFixed(2)} π` : '— π'}
        </div>
        <div className={styles.balanceActions}>
          <button className={styles.actionBtn}>↓ Receive</button>
          <button className={styles.actionBtn}>↑ Send</button>
        </div>
      </section>

      {/* ── Wallets ── */}
      <section className={`${styles.walletsSection} fade-up-1`}>
        <h2 className={styles.sectionTitle}>My Wallets</h2>
        <div className={styles.walletsGrid}>
          {wallet ? (
            <div className={styles.walletCard}>
              <div className={styles.walletHeader}>
                <span className={styles.walletIcon}>π</span>
                <span className={styles.walletBadge}>Primary</span>
              </div>
              <div className={styles.walletName}>Pi Wallet</div>
              <div className={`${styles.walletBalance} gold-text`}>
                {wallet.balance.toFixed(2)} π
              </div>
              {wallet.address && (
                <div className={styles.walletAddress}>{wallet.address}</div>
              )}
            </div>
          ) : (
            <div className={styles.walletCard}>
              <div className={styles.walletName} style={{ color: 'var(--muted)' }}>
                لا توجد محفظة
              </div>
            </div>
          )}
          <div className={`${styles.walletCard} ${styles.walletCardAdd}`}>
            <div className={styles.addIcon}>+</div>
            <div className={styles.addText}>Link New Wallet</div>
          </div>
        </div>
      </section>

      {/* ── Transactions ── */}
      <section className={`${styles.transactionsSection} fade-up-2`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Transaction History</h2>
          <div className={styles.filters}>
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={e => setFilterType(e.target.value as TxType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="send">Send</option>
              <option value="receive">Receive</option>
              <option value="payment">Payment</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as TxStatus | 'all')}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className={styles.transactionsTable}>
          <div className={styles.tableHeader}>
            <span>Type</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
            <span>TX Hash</span>
          </div>
          <div className={styles.tableBody}>
            {transactions.length === 0 ? (
              <EmptyTransactions />
            ) : (
              transactions.map(tx => (
                <TransactionRow key={tx.id} tx={tx} />
              ))
            )}
          </div>
        </div>

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
      </section>

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────
function TransactionRow({ tx }: { tx: Transaction }) {
  const positive = isPositive(tx.type);
  // txHash أو txId — نعرض اللي موجود
  const hash = tx.txHash ?? tx.txId ?? null;

  return (
    <div className={styles.tableRow}>
      <div className={styles.txType}>
        <span className={styles.txIcon}>{getTypeIcon(tx.type)}</span>
        <span className={styles.txLabel}>{tx.type}</span>
      </div>
      <div className={`${styles.txAmount} ${positive ? styles.positive : styles.negative}`}>
        {positive ? '+' : '-'}{tx.amount.toFixed(2)} π
      </div>
      <div className={styles.txStatus}>
        <StatusBadge status={tx.status} />
      </div>
      <div className={styles.txDate}>{formatDate(tx.createdAt)}</div>
      <div className={styles.txHash}>
        {hash ? (
          <a href="#" className={styles.hashLink}>
            {hash.slice(0, 10)}...
          </a>
        ) : (
          <span style={{ color: 'var(--muted)' }}>—</span>
        )}
      </div>
    </div>
  );
}

function EmptyTransactions() {
  return (
    <div className={styles.emptyState}>
      <span>📭</span>
      <p>No transactions yet</p>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonTable} />
    </div>
  );
          }
