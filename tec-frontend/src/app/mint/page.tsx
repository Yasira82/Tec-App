'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams }                           from 'next/navigation';
import PiSdkLoader                                   from '@/components/PiSdkLoader';

export default function MintPage() {
  const params    = useSearchParams();
  const assetId   = params.get('asset_id') ?? '';
  const name      = params.get('name') ?? '';
  const tier      = params.get('tier') ?? 'Common';
  const returnUrl = params.get('return_url') ?? 'https://tec-assets-app.vercel.app/app';

  const [status,   setStatus]   = useState<'idle' | 'auth' | 'payment' | 'minting' | 'success' | 'error'>('idle');
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const started = useRef(false);

  const tierColor = tier === 'Legendary'  ? '#ffd700'
                  : tier === 'Ultra Rare' ? '#b39ddb'
                  : tier === 'Rare'       ? '#7eb8f7'
                  : tier === 'Uncommon'   ? '#7ee7c0'
                  : '#d4af37';

  const startMint = useCallback(async () => {
    if (started.current) return;
    started.current = true;

    try {
      if (!window.Pi) throw new Error('Open in Pi Browser');

      setStatus('auth');
      await window.Pi.authenticate(['username', 'payments'], () => {});

      setStatus('payment');
      await new Promise<void>((resolve, reject) => {
        window.Pi.createPayment(
          {
            amount:   0.1,
            memo:     `Mint ${name} as NFT`,
            metadata: { assetId, type: 'domain_mint' },
          },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              try {
                await fetch('/api/payment/approve', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paymentId }),
                });
              } catch { reject(new Error('Approval failed')); }
            },
            onReadyForServerCompletion: async (_paymentId: string, txid: string) => {
              try {
                setStatus('minting');
                const res = await fetch('/api/bff/assets/mint-as-nft', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ assetId, transactionId: txid }),
                });
                if (!res.ok) throw new Error('Mint failed');
                resolve();
              } catch (e) { reject(e); }
            },
            onCancel: () => reject(new Error('Cancelled')),
            onError:  (e: unknown) => reject(e),
          }
        );
      });

      setStatus('success');
      setTimeout(() => { window.location.href = returnUrl; }, 1500);

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mint failed';
      if (msg === 'Cancelled') {
        window.location.href = returnUrl;
      } else {
        setError(msg);
        setStatus('error');
      }
    }
  }, [assetId, name, returnUrl]);

  useEffect(() => {
    if (!sdkReady) return;
    if (!assetId || !name) { setError('Invalid mint request'); setStatus('error'); return; }
    startMint();
  }, [sdkReady, assetId, name, startMint]);

  return (
    <>
      <PiSdkLoader
        sandbox={process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'}
        timeout={15000}
        onReady={() => setSdkReady(true)}
      />

      <div style={{
        minHeight: '100vh', background: '#020205', color: '#fff',
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
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            {name}
          </div>

          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700,
            color: tierColor, background: `${tierColor}15`,
            border: `1px solid ${tierColor}30`,
            borderRadius: 20, padding: '4px 14px', marginBottom: 32, letterSpacing: 1,
          }}>
            ✦ {tier.toUpperCase()} DOMAIN
          </div>

          {status === 'error' ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
              <div style={{ fontSize: 14, color: '#e74c3c', marginBottom: 20 }}>{error}</div>
              <button
                onClick={() => window.location.href = returnUrl}
                style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 14, cursor: 'pointer',
                }}
              >
                Back to Assets
              </button>
            </>
          ) : status === 'success' ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0', marginBottom: 8 }}>
                Minted Successfully!
              </div>
              <div style={{ fontSize: 12, color: '#4a4a5a' }}>Redirecting back...</div>
            </>
          ) : (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '3px solid #ffffff10',
                borderTopColor: tierColor,
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }} />
              <div style={{ fontSize: 14, color: '#6b6b7a' }}>
                {!sdkReady           ? 'Loading Pi SDK...'      :
                 status === 'auth'    ? 'Authenticating...'     :
                 status === 'payment' ? 'Processing payment...' :
                 status === 'minting' ? 'Minting your NFT...'   :
                 'Preparing...'}
              </div>
            </>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}
