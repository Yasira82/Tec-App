'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams }                  from 'next/navigation';
import { usePiAuth }                        from '@/lib-client/hooks/usePiAuth';
import { createU2APayment }                 from '@/lib-client/pi/pi-payment';
import { piSession }                        from '@/lib-client/pi/pi-session';
import { usePiSdkReady }                    from '@/lib-client/hooks/usePiSdkReady';

type PayStatus = 'idle' | 'paying' | 'success' | 'cancelled' | 'error';

export default function PayClient() {
  const params     = useSearchParams();
  const { user }   = usePiAuth();
  const { piReady, ensurePiAuth } = usePiSdkReady();

  // ✅ Query params من Tec-Assets
  const assetId    = params.get('asset_id')   ?? '';
  const assetType  = params.get('asset_type') ?? 'asset';
  const assetName  = params.get('name')       ?? 'Asset';
  const price      = parseFloat(params.get('price') ?? '0');
  const returnUrl  = params.get('return_url') ?? 'https://tec-assets-app.vercel.app/app';
  const listingId  = params.get('listing_id') ?? '';

  const [status,  setStatus]  = useState<PayStatus>('idle');
  const [message, setMessage] = useState('');
  const [txid,    setTxid]    = useState('');

  // ✅ Validate params
  const isValid = assetId && price > 0 && listingId;

  const handlePay = useCallback(async () => {
    if (!piReady || !isValid) return;

    const locked = await piSession.acquirePaymentLock();
    if (!locked) return;

    setStatus('paying');

    try {
      await ensurePiAuth();

      const result = await createU2APayment(
        price,
        `Buy ${assetName} — TEC Assets`,
        {
          asset_id:   assetId,
          asset_type: assetType,
          listing_id: listingId,
          buyer_id:   user?.id,
        },
      );

      if (result.success && result.status === 'completed') {

  // ✅ Domain registration
  if (listingId.startsWith('domain-reg-')) {
    await fetch('/api/assets/provision', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug:       assetName.toLowerCase().trim(),
        payment_id: result.paymentId,
      }),
    });

  // ✅ Marketplace buy
  } else {
    await fetch('/api/assets/buy', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: listingId,
        payment_id: result.paymentId,
        txid:       result.txid,
      }),
    });
  }

  setTxid(result.txid ?? '');
  setStatus('success');

        // ✅ بعد 3 ثواني رجّع لـ Tec-Assets
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 3000);

      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
        setMessage('Payment cancelled');
      } else {
        setStatus('error');
        setMessage(result.message ?? 'Payment failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      piSession.releasePaymentLock();
    }
  }, [piReady, isValid, ensurePiAuth, price, assetName, assetId, assetType, listingId, user?.id, returnUrl]);

  if (!isValid) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={styles.title}>Invalid Payment Link</div>
          <div style={styles.sub}>Missing required parameters</div>
          <button style={styles.btn} onClick={() => window.history.back()}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Asset Info */}
        <div style={styles.assetBox}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {assetType === 'domain' ? '🌐' : assetType === 'nft' ? '🎨' : '💎'}
          </div>
          <div style={styles.assetName}>{assetName}</div>
          <div style={styles.assetType}>{assetType.toUpperCase()}</div>
        </div>

        {/* Price */}
        <div style={styles.priceBox}>
          <div style={styles.priceLabel}>Price</div>
          <div style={styles.price}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 28 }}>π</span>
            <span style={{ fontSize: 36, fontWeight: 900 }}>{price.toFixed(2)}</span>
          </div>
        </div>

        {/* Status */}
        {status === 'idle' && (
          <>
            <div style={styles.warning}>
              ⚠️ You will be charged {price} Pi from your wallet
            </div>
            <button
              style={{
                ...styles.btn,
                opacity: piReady ? 1 : 0.5,
                cursor:  piReady ? 'pointer' : 'not-allowed',
              }}
              onClick={handlePay}
              disabled={!piReady}
            >
              {piReady ? `Pay ${price}π` : 'Connecting to Pi...'}
            </button>
            <button style={styles.cancelBtn} onClick={() => window.location.href = returnUrl}>
              Cancel
            </button>
          </>
        )}

        {status === 'paying' && (
          <div style={styles.statusBox}>
            <div style={styles.spinner} />
            <div style={styles.statusText}>Processing payment...</div>
            <div style={styles.statusSub}>Please confirm in Pi Browser</div>
          </div>
        )}

        {status === 'success' && (
          <div style={styles.statusBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ ...styles.statusText, color: '#7ee7c0' }}>Payment Successful!</div>
            {txid && (
              <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'monospace', marginTop: 8 }}>
                txid: {txid.slice(0, 24)}...
              </div>
            )}
            <div style={styles.statusSub}>Redirecting to your assets...</div>
          </div>
        )}

        {status === 'cancelled' && (
          <div style={styles.statusBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
            <div style={styles.statusText}>Payment Cancelled</div>
            <button style={styles.btn} onClick={() => setStatus('idle')}>Try Again</button>
            <button style={styles.cancelBtn} onClick={() => window.location.href = returnUrl}>
              Go Back
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.statusBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
            <div style={{ ...styles.statusText, color: '#e74c3c' }}>Payment Failed</div>
            <div style={styles.statusSub}>{message}</div>
            <button style={styles.btn} onClick={() => setStatus('idle')}>Try Again</button>
            <button style={styles.cancelBtn} onClick={() => window.location.href = returnUrl}>
              Go Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', background: '#020205',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%', maxWidth: 400,
    background: '#0d0d14', borderRadius: 28,
    border: '1px solid #d4af3720', padding: '32px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
  },
  assetBox: {
    textAlign: 'center', padding: '20px',
    background: '#ffffff05', borderRadius: 20,
    border: '1px solid #ffffff08', width: '100%',
  },
  assetName: {
    fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4,
  },
  assetType: {
    fontSize: 10, color: '#4a4a5a', letterSpacing: 3,
  },
  priceBox: {
    textAlign: 'center', width: '100%',
  },
  priceLabel: {
    fontSize: 11, color: '#4a4a5a', letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 8,
  },
  price: {
    color: '#d4af37', display: 'flex',
    alignItems: 'baseline', justifyContent: 'center', gap: 4,
  },
  warning: {
    fontSize: 12, color: '#6b6b7a', textAlign: 'center',
    padding: '12px', background: '#ffffff05',
    borderRadius: 12, border: '1px solid #ffffff08',
    width: '100%',
  },
  btn: {
    width: '100%', padding: '16px',
    background: 'linear-gradient(135deg,#d4af37,#b8882a)',
    border: 'none', borderRadius: 16,
    color: '#0a0800', fontSize: 16, fontWeight: 800, cursor: 'pointer',
  },
  cancelBtn: {
    width: '100%', padding: '14px',
    background: 'none', border: '1px solid #ffffff10',
    borderRadius: 16, color: '#4a4a5a',
    fontSize: 14, cursor: 'pointer',
  },
  statusBox: {
    textAlign: 'center', width: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  statusText: {
    fontSize: 20, fontWeight: 800, color: '#fff',
  },
  statusSub: {
    fontSize: 13, color: '#4a4a5a',
  },
  spinner: {
    width: 48, height: 48, borderRadius: '50%',
    border: '3px solid #d4af3730',
    borderTop: '3px solid #d4af37',
    animation: 'spin 0.8s linear infinite',
  },
};
