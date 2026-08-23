'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams }                                      from 'next/navigation';
import { usePiAuth }                                            from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                                        from '@/lib-client/hooks/usePiSdkReady';
import { piSession }                                            from '@/lib-client/pi/pi-session';
import { PiRuntime }                                           from '@/lib-client/pi/PiRuntime';

const HUB_ORIGIN = 'https://hub.tecosystem.app';

const getCsrf = (): string =>
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const goBack = (returnUrl: string) => {
  window.location.href = `/api/auth/sso?target=${encodeURIComponent(returnUrl)}`;
};

const Spinner = () => (
  <div style={{ minHeight: '100vh', background: '#050816',
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 48, height: 48, borderRadius: '50%',
      border: '3px solid #ffffff10', borderTopColor: 'var(--tec-gold)',
      animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function MintPageInner() {
  const params    = useSearchParams();
  const assetId   = params.get('asset_id')   ?? '';
  const name      = params.get('name')       ?? '';
  const tier      = params.get('tier')       ?? 'Common';
  const returnUrl = params.get('return_url') ?? 'https://assets.tecosystem.app/app';

  const { isAuthenticated, isLoading } = usePiAuth();
  const { piReady, ensurePiAuth }      = usePiSdkReady();

  const [status,   setStatus]   = useState<'idle' | 'auth' | 'payment' | 'minting' | 'success' | 'error'>('idle');
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const hasStarted = useRef(false);

  const tierColor = tier === 'Legendary'  ? 'var(--tec-gold)'
                  : tier === 'Ultra Rare' ? '#b39ddb'
                  : tier === 'Rare'       ? '#7eb8f7'
                  : tier === 'Uncommon'   ? '#7ee7c0'
                  : 'var(--tec-gold)';

  useEffect(() => {
    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady, { once: true });
    if (window.__TEC_PI_READY) setSdkReady(true);
    return () => window.removeEventListener('tec-pi-ready', onReady);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      window.location.href = `${HUB_ORIGIN}/?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [isLoading, isAuthenticated]);

  const startMint = useCallback(async () => {
    if (!PiRuntime.isAvailable()) { setError('Open in Pi Browser'); setStatus('error'); return; }
    if (!assetId || !name) { setError('Invalid mint request'); setStatus('error'); return; }

    PiRuntime.init(
      process.env.NEXT_PUBLIC_PI_SANDBOX === 'true',
      process.env.NEXT_PUBLIC_PI_APP_ID ?? undefined,
    );

    try {
      await fetch('/api/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'x-csrf-token': getCsrf() },
      });
    } catch { /* تكمل */ }

    if (hasStarted.current) return;
    hasStarted.current = true;

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setError('Payment already in progress'); setStatus('error'); return; }

    setStatus('auth');
    try {
      piSession.reset();
      const authOk = await ensurePiAuth();
      if (!authOk) {
        piSession.releasePaymentLock();
        setError(`Pi auth failed: ${piSession.lastError ?? 'unknown'}`);
        setStatus('error');
        return;
      }

      await new Promise(r => setTimeout(r, 1000));

      // ✅ أنشئ payment record أولاً
      let internalPaymentId: string | null = null;
      try {
        const createRes = await fetch('/api/payment/create', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
          body: JSON.stringify({
            amount:         1,
            currency:       'PI',
            payment_method: 'pi',
            metadata:       { assetId, type: 'domain_mint', name },
          }),
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          internalPaymentId = createData?.data?.payment?.id
            ?? createData?.data?.id
            ?? createData?.data?.payment_id
            ?? null;
        }
      } catch { /* تكمل */ }

      setStatus('payment');
      await new Promise<void>((resolve, reject) => {
        PiRuntime.createPayment(
          {
            amount:   1,
            memo:     `Mint ${name} as NFT`,
            metadata: { assetId, type: 'domain_mint' },
          },
          {
            onReadyForServerApproval: async (piPaymentId: string) => {
              try {
                const res = await fetch('/api/payment/approve', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
                  body: JSON.stringify({
                    payment_id:    internalPaymentId ?? piPaymentId,
                    pi_payment_id: piPaymentId,
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  reject(new Error(err?.message ?? `Approval failed: ${res.status}`));
                }
              } catch (e) {
                reject(e instanceof Error ? e : new Error('Approval failed'));
              }
            },
            onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
              try {
                setStatus('minting');

                // ✅ أولاً: أخبر Pi إن الدفع اتكمل عشان يقفل الـ dialog
                await fetch('/api/payment/complete', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
                  body: JSON.stringify({
                    payment_id:    internalPaymentId ?? piPaymentId,
                    pi_payment_id: piPaymentId,
                    txid,
                  }),
                });

                // ✅ تانياً: اعمل mint للـ NFT
                const res = await fetch('/api/bff/assets/mint-as-nft', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
                  body: JSON.stringify({ assetId, transactionId: txid }),
                });
                if (!res.ok) throw new Error('Mint failed');
                resolve();
              } catch (e) { reject(e); }
            },
            onCancel: () => goBack(returnUrl),
            onError:  (e: unknown) => {
              reject(e instanceof Error ? e : new Error('Pi SDK error'));
            },
          }
        );
      });

      setStatus('success');
      piSession.releasePaymentLock();
      setTimeout(() => goBack(returnUrl), 1500);

    } catch (e) {
      piSession.releasePaymentLock();
      const msg = e instanceof Error ? e.message : 'Mint failed';
      setError(msg);
      setStatus('error');
    }
    }, [assetId, name, returnUrl, ensurePiAuth]);

  if (isLoading || !sdkReady) return <Spinner />;

  return (
    <div style={{
      minHeight: '100vh', background: '#050816', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(13,13,20,0.95)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${tierColor}30`,
        borderRadius: 24, padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{name}</div>
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700,
          color: tierColor, background: `${tierColor}15`,
          border: `1px solid ${tierColor}30`,
          borderRadius: 20, padding: '4px 14px', marginBottom: 32, letterSpacing: 1,
        }}>
          ❆ {tier.toUpperCase()} DOMAIN
        </div>

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#6b6b7a', marginBottom: 8 }}>
              Minting fee: <span style={{ color: tierColor, fontWeight: 700 }}>1π</span>
            </div>
            <button onClick={startMint} style={{
              padding: '16px 40px', borderRadius: 18,
              background: `linear-gradient(135deg,${tierColor},${tierColor}90)`,
              border: 'none', color: '#0a0800',
              fontSize: 16, fontWeight: 900, cursor: 'pointer',
              boxShadow: `0 8px 32px ${tierColor}40`,
            }}>
              🎨 Mint as NFT
            </button>
            <button onClick={() => goBack(returnUrl)} style={{
              background: 'none', border: 'none',
              color: '#4a4a5a', fontSize: 12, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        )}

        {(status === 'auth' || status === 'payment' || status === 'minting') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%',
              border: '3px solid #ffffff10', borderTopColor: tierColor,
              animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>
              {status === 'auth'    ? 'Authenticating...'     :
               status === 'payment' ? 'Processing payment...' :
                                      'Minting your NFT...'}
            </div>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>🎨</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>Minted Successfully!</div>
            <div style={{ fontSize: 12, color: '#4a4a5a' }}>Redirecting back...</div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 40 }}>❌</div>
            <div style={{ fontSize: 14, color: '#e74c3c', marginBottom: 8 }}>{error}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { hasStarted.current = false; setStatus('idle'); }}
                style={{ padding: '12px 20px', borderRadius: 12,
                  background: `${tierColor}15`, border: `1px solid ${tierColor}40`,
                  color: tierColor, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Try Again
              </button>
              <button onClick={() => goBack(returnUrl)}
                style={{ padding: '12px 20px', borderRadius: 12,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Back to Assets
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function MintPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MintPageInner />
    </Suspense>
  );
            }
