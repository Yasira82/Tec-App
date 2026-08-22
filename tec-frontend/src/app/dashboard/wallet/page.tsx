'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, TxType, TxStatus, Transaction } from '@/lib-client/hooks/useWallet';
import { useWalletRealtime, WalletUpdatedEvent }     from '@/lib-client/hooks/useWalletRealtime';
import { sessionToken }                              from '@/lib-client/pi/session-source';
import { useTranslation, errorText }                 from '@/lib/i18n';
import { buildHeaders }                              from '@/lib/request-id';
import styles from './wallet.module.css';

function getTypeIcon(type: string) {
  switch (type) {
    case 'receive': case 'credit':  return '↓';
    case 'send':    case 'debit':   return '↑';
    case 'payment':                 return '→';
    default:                        return '•';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPositive(type: string) { return type === 'receive' || type === 'credit'; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: styles.statusCompleted,
    pending:   styles.statusPending,
    failed:    styles.statusFailed,
    cancelled: styles.statusFailed,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '20px',
};
const modalStyle: React.CSSProperties = {
  background: '#0a0a0f', border: '1px solid #FBBF2430',
  borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 420,
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#6b6b7a', marginBottom: 6, letterSpacing: 0.5,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#0B1020',
  border: '1px solid #ffffff15', borderRadius: 10, color: '#fff',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
  border: 'none', borderRadius: 10, color: '#0a0800', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnOutline: React.CSSProperties = {
  padding: '10px 20px', background: 'none', border: '1px solid #ffffff20',
  borderRadius: 10, color: '#6b6b7a', fontSize: 13, cursor: 'pointer',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Send Modal ────────────────────────────────────────────────
function SendModal({ myWalletId, onClose, onSuccess }: {
  myWalletId: string;
  onClose:    () => void;
  onSuccess:  () => void;
}) {
  const [tab,     setTab]     = useState<'internal' | 'pi'>('internal');
  const [toInput, setToInput] = useState('');
  const [piUid,   setPiUid]   = useState('');
  const [amount,  setAmount]  = useState('');
  const [memo,    setMemo]    = useState('TEC Transfer');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const validate = (recipient: string): boolean => {
    if (!recipient || !amount) { setError('All fields required'); return false; }
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) { setError('Invalid amount'); return false; }
    return true;
  };

  const handleInternalSend = async () => {
    if (!validate(toInput)) return;
    setLoading(true); setError(null);
    try {
      const token   = sessionToken();
      const trimmed = toInput.trim().replace('@', '');
      const isUUID  = UUID_REGEX.test(trimmed);

      let toWalletId: string;

      if (isUUID) {
        // ✅ Wallet ID مباشرة — مفيش lookup
        toWalletId = trimmed;
      } else {
        // Pi Username → lookup
        const lookupRes  = await fetch(`/api/wallet/lookup?piUsername=${encodeURIComponent(trimmed)}`, {
          credentials: 'include',
          headers:     token ? { Authorization: `Bearer ${token}` } : {},
        });
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.walletId) throw new Error(lookupData.error ?? 'Recipient not found');
        toWalletId = lookupData.walletId;
      }

      if (toWalletId === myWalletId) { setError('Cannot send to your own wallet'); return; }

      const res  = await fetch('/api/wallet/transfer', {
        method:      'POST',
        credentials: 'include',
        headers:     buildHeaders(token),
        body: JSON.stringify({
          fromWalletId: myWalletId,
          toWalletId,
          amount:       parseFloat(amount),
          assetType:    'PI',
          description:  memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? data?.message ?? 'Transfer failed');
      onSuccess(); onClose();
    } catch (e) { setError((e as Error).message); }
    finally     { setLoading(false); }
  };

  const handlePiSend = async () => {
    if (!validate(piUid)) return;
    setLoading(true); setError(null);
    try {
      const { createA2UPayment } = await import('@/lib-client/pi/pi-payment');
      const result = await createA2UPayment({ recipientUid: piUid, amount: parseFloat(amount), memo });
      if (result.success) { onSuccess(); onClose(); }
      else throw new Error(result.message ?? 'Pi transfer failed');
    } catch (e) { setError((e as Error).message); }
    finally     { setLoading(false); }
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: active ? '#FBBF2415' : 'none',
    border: 'none', borderBottom: active ? '2px solid #FBBF24' : '2px solid transparent',
    color: active ? '#FBBF24' : '#6b6b7a', fontSize: 13,
    fontWeight: active ? 700 : 400, cursor: 'pointer',
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>↑ Send π</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid #ffffff10' }}>
          <button style={tabBtn(tab === 'internal')} onClick={() => setTab('internal')}>
            🏦 Internal (TEC)
          </button>
          <button style={{ ...tabBtn(false), opacity: 0.4, cursor: 'not-allowed' }} disabled>
            π Pi Network (Soon)
          </button>
        </div>

        {tab === 'internal' && (
          <>
            <div style={{ padding: '8px 12px', background: '#0d1a0d', border: '1px solid #7ee7c030', borderRadius: 8, marginBottom: 14 }}>
              <p style={{ color: '#7ee7c0', fontSize: 11, margin: 0 }}>
                💡 Enter recipient <strong>Wallet ID</strong> (from their Receive screen) or <strong>Pi Username</strong>
              </p>
            </div>

            <label style={labelStyle}>Wallet ID or Pi Username</label>
            <input
              style={inputStyle}
              placeholder="UUID or @piUsername..."
              value={toInput}
              onChange={e => setToInput(e.target.value)}
            />

            <label style={{ ...labelStyle, marginTop: 12 }}>Amount (π)</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />

            <label style={{ ...labelStyle, marginTop: 12 }}>Description</label>
            <input
              style={inputStyle}
              placeholder="TEC Transfer"
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />
          </>
        )}

        {tab === 'pi' && (
          <>
            <label style={labelStyle}>Recipient Pi UID</label>
            <input style={inputStyle} placeholder="Pi UID..." value={piUid}
              onChange={e => setPiUid(e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Amount (π)</label>
            <input style={inputStyle} type="number" placeholder="0.00" value={amount}
              onChange={e => setAmount(e.target.value)} />
          </>
        )}

        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 8 }}>⚠️ {error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={btnOutline} onClick={onClose}>Cancel</button>
          <button
            style={btnPrimary}
            onClick={tab === 'internal' ? handleInternalSend : handlePiSend}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Internally'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Receive Modal ─────────────────────────────────────────────
function ReceiveModal({ walletId, balance, onClose }: {
  walletId: string;
  balance:  number;
  onClose:  () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(walletId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>↓ Receive π</h2>

        <div style={{ padding: '8px 12px', background: '#0d1a0d', border: '1px solid #7ee7c030', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: '#7ee7c0', fontSize: 11, margin: 0 }}>
            💡 Share your <strong>Wallet ID</strong> so others can send you TEC balance.
          </p>
        </div>

        <label style={labelStyle}>Your Wallet ID</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
            value={walletId}
            readOnly
          />
          <button
            style={{ ...btnPrimary, padding: '10px 14px', whiteSpace: 'nowrap' }}
            onClick={copy}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div style={{ padding: '12px 16px', background: '#0B1020', border: '1px solid #FBBF2420', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 4 }}>Current Balance</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FBBF24' }}>{balance.toFixed(2)} π</div>
        </div>

        <button style={{ ...btnOutline, width: '100%', marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────
export default function WalletPage() {
  const { t } = useTranslation();
  const {
    wallet, transactions, isLoading, isRefreshing, error,
    page, totalPages, filterType, filterStatus,
    refetch, setPage, setFilterType, setFilterStatus, updateBalance,
  } = useWallet();

  const [liveFlash,   setLiveFlash]   = useState(false);
  const [showSend,    setShowSend]    = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  // Deep-link from the Hub wallet card: /dashboard/wallet?action=send|receive
  // opens the real Send/Receive modal directly (no reimplemented payment logic).
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('action');
    if (a === 'send')    setShowSend(true);
    if (a === 'receive') setShowReceive(true);
  }, []);

  const handleBalanceUpdate = useCallback((event: WalletUpdatedEvent) => {
    updateBalance(event.balance);
    setLiveFlash(true);
    setTimeout(() => setLiveFlash(false), 1000);
    refetch();
  }, [updateBalance, refetch]);

  const { isConnected } = useWalletRealtime({ onBalanceUpdate: handleBalanceUpdate });

  if (isLoading) return <div className={styles.container}><WalletSkeleton /></div>;

  if (error) return (
    <div className={styles.container}>
      <div className={styles.errorState}>
        {/* The session-expired case arrives as a sentinel, not as prose — it is the
            one message on this page a user MUST be able to read in their language. */}
        <span>⚠️</span><p>{errorText(t, error)}</p>
        <button className={styles.actionBtn} onClick={refetch}>إعادة المحاولة</button>
      </div>
    </div>
  );

  const displayBalance = wallet?.balance ?? null;
  const myWalletId     = wallet?.walletId ?? '';

  return (
    <div className={styles.container}>

      {showSend && (
        <SendModal
          myWalletId={myWalletId}
          onClose={() => setShowSend(false)}
          onSuccess={refetch}
        />
      )}
      {showReceive && (
        <ReceiveModal
          walletId={myWalletId}
          balance={wallet?.balance ?? 0}
          onClose={() => setShowReceive(false)}
        />
      )}

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
          {isRefreshing && <span className={styles.refreshing}>⟳ جاري التحديث...</span>}
        </div>
      </header>

      {/* ── Balance Card ── */}
      <section className={`${styles.balanceCard} fade-up`}>
        <div className={styles.balanceLabel}>Total Balance</div>
        <div className={`${styles.balanceAmount} gold-text ${liveFlash ? styles.balanceFlash : ''}`}>
          {displayBalance != null ? `${displayBalance.toFixed(2)} π` : '— π'}
        </div>
        <div className={styles.balanceActions}>
          <button className={styles.actionBtn} onClick={() => setShowReceive(true)}>↓ Receive</button>
          <button className={styles.actionBtn} onClick={() => setShowSend(true)}>↑ Send</button>
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
              <div className={`${styles.walletBalance} gold-text`}>{wallet.balance.toFixed(2)} π</div>
              {myWalletId && (
                <div className={styles.walletAddress} style={{ fontSize: 10 }}>
                  ID: {myWalletId.slice(0, 16)}...
                </div>
              )}
            </div>
          ) : (
            <div className={styles.walletCard}>
              <div className={styles.walletName} style={{ color: 'var(--muted)' }}>لا توجد محفظة</div>
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
            <select className={styles.filterSelect} value={filterType}
              onChange={e => setFilterType(e.target.value as TxType | 'all')}>
              <option value="all">All Types</option>
              <option value="send">Send</option>
              <option value="receive">Receive</option>
              <option value="payment">Payment</option>
            </select>
            <select className={styles.filterSelect} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as TxStatus | 'all')}>
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className={styles.transactionsTable}>
          <div className={styles.tableHeader}>
            <span>Type</span><span>Amount</span><span>Status</span>
            <span>Date</span><span>TX Hash</span>
          </div>
          <div className={styles.tableBody}>
            {transactions.length === 0
              ? <EmptyTransactions />
              : transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
            }
          </div>
        </div>

        <div className={styles.pagination}>
          <button className={styles.paginationBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className={styles.paginationInfo}>Page {page} of {totalPages}</span>
          <button className={styles.paginationBtn} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const positive = isPositive(tx.type);
  const hash     = tx.txHash ?? tx.txId ?? null;
  return (
    <div className={styles.tableRow}>
      <div className={styles.txType}>
        <span className={styles.txIcon}>{getTypeIcon(tx.type)}</span>
        <span className={styles.txLabel}>{tx.type}</span>
      </div>
      <div className={`${styles.txAmount} ${positive ? styles.positive : styles.negative}`}>
        {positive ? '+' : '-'}{tx.amount.toFixed(2)} π
      </div>
      <div className={styles.txStatus}><StatusBadge status={tx.status} /></div>
      <div className={styles.txDate}>{formatDate(tx.createdAt)}</div>
      <div className={styles.txHash}>
        {hash
          ? <a href="#" className={styles.hashLink}>{hash.slice(0, 10)}...</a>
          : <span style={{ color: 'var(--muted)' }}>—</span>
        }
      </div>
    </div>
  );
}

function EmptyTransactions() {
  return <div className={styles.emptyState}><span>📭</span><p>No transactions yet</p></div>;
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
