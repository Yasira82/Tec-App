'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPi, getAccessToken, resolvePendingPayment, fetchWithAuth } from '@/lib-client/pi/pi-auth';
import { createA2UPayment } from '@/lib-client/pi/pi-payment';
import type { TecUser } from '@/types/pi.types';

const isSandboxMode = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';
const appId          = process.env.NEXT_PUBLIC_PI_APP_ID;
const gatewayUrl     = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
const missingEnvVars = isSandboxMode && (!appId || !gatewayUrl);

export default function PiPaymentButton() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(false);
  const [user,      setUser]      = useState<TecUser | null>(null);
  const [balance,   setBalance]   = useState<number | string>('...');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [a2uMsg,    setA2uMsg]    = useState<{ text: string; isError: boolean } | null>(null);

  const setError    = (text: string) => setStatusMsg({ text, isError: true });
  const setInfo     = (text: string) => setStatusMsg({ text, isError: false });
  const clearStatus = () => setStatusMsg(null);

  const fetchBalance = useCallback(async (userId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tec_access_token') : null;
      const res   = await fetch(`/api/wallet/balance?userId=${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setBalance(data?.balance ?? 0);
    } catch {
      setBalance(0);
    }
  }, []);

  const handleAuth = async () => {
    try {
      setLoading(true);
      clearStatus();
      const authData = await loginWithPi();
      setUser(authData.user);
      fetchBalance(authData.user.id);
      router.push('/hub'); // ← Hub بدل Dashboard
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = useCallback(async () => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) {
      setError('Session expired. Please sign in again.');
      setUser(null); setBalance('...');
      return;
    }
    try {
      setLoading(true);
      setInfo('Processing payment...');

      const createRes = await fetchWithAuth('/api/payment/create', {
        method: 'POST',
        body:   JSON.stringify({ userId: user.id, amount: 1, currency: 'PI', payment_method: 'pi', metadata: { piUserId: user.piId } }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to initiate payment');
      }

      const createData      = await createRes.json();
      const internalPaymentId: string = createData?.data?.payment?.id ?? createData?.data?.id;
      if (!internalPaymentId) throw new Error('Invalid payment response from server');

      // @ts-ignore
      window.Pi.createPayment(
        { amount: 1, memo: 'Purchase 0.1 TEC', metadata: { internalPaymentId } },
        {
          onReadyForServerApproval: async (piPaymentId: string) => {
            try {
              await fetchWithAuth('/api/payment/approve', {
                method: 'POST',
                body:   JSON.stringify({ payment_id: internalPaymentId, pi_payment_id: piPaymentId }),
              });
            } catch (err) { console.error('[TEC] Approval error:', err); }
          },

          onReadyForServerCompletion: async (_piPaymentId: string, txid: string) => {
            try {
              const res = await fetchWithAuth('/api/payment/complete', {
                method: 'POST',
                body:   JSON.stringify({ payment_id: internalPaymentId, transaction_id: txid }),
              });
              if (res.ok) {
                setInfo('Payment successful! 🎉');
                setTimeout(() => fetchBalance(user.id), 2000);
              } else {
                setError('Payment completion failed.');
              }
            } catch { setError('Network error during completion.'); }
            finally  { setLoading(false); }
          },

          onCancel: () => { setError('Payment cancelled.'); setLoading(false); },

          onError: async (error: Error, payment?: unknown) => {
            const msg              = error?.message ?? '';
            const isPendingError   = msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('already have');
            if (isPendingError) {
              const id = (payment as { identifier?: string } | undefined)?.identifier;
              if (id) {
                setInfo('Resolving pending payment...');
                const result = await resolvePendingPayment(id);
                setInfo(result ? `Resolved (${result.action}). Tap Pay again.` : 'Failed to resolve. Try later.');
              } else {
                setError('Pending payment detected. Try again in a moment.');
              }
            } else {
              setError('Payment error. Please try again.');
            }
            setLoading(false);
          },
        }
      );
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Payment failed');
      setLoading(false);
    }
  }, [user, fetchBalance]);

  const handleA2U = useCallback(async () => {
    if (!user) return;
    setA2uMsg(null);
    if (isSandboxMode) { setA2uMsg({ text: 'A2U not available in Sandbox.', isError: false }); return; }
    if (!getAccessToken()) { setA2uMsg({ text: 'Session expired.', isError: true }); return; }
    try {
      setA2uMsg({ text: 'Processing A2U...', isError: false });
      await createA2UPayment({ recipientUid: user.piId, amount: 0.001, memo: 'TEC A2U reward', metadata: { userId: user.id } });
      setA2uMsg({ text: 'A2U sent!', isError: false });
    } catch (err) {
      setA2uMsg({ text: err instanceof Error ? err.message : 'A2U failed', isError: true });
    }
  }, [user]);

  if (missingEnvVars) {
    const missing = [...(!appId ? ['NEXT_PUBLIC_PI_APP_ID'] : []), ...(!gatewayUrl ? ['NEXT_PUBLIC_API_GATEWAY_URL'] : [])];
    return (
      <div className="w-full max-w-sm mx-auto p-4">
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          <p className="font-semibold mb-2">⚠️ Missing env vars:</p>
          <ul className="list-disc list-inside">{missing.map(v => <li key={v}><code>{v}</code></li>)}</ul>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center py-2">
      <div className="w-full max-w-sm">

        {!user ? (
          /* ── زر Sign In ───────────────────────────────────── */
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleAuth}
              disabled={loading}
              style={{
                background:    'linear-gradient(135deg, #d4af37 0%, #f5d76e 40%, #b8882a 100%)',
                boxShadow:     '0 0 32px rgba(212,175,55,0.35), 0 4px 16px rgba(0,0,0,0.4)',
                letterSpacing: '0.15em',
              }}
              className="
                relative w-full
                text-[#0a0800] font-black
                py-4 px-6 rounded-2xl
                text-base uppercase
                transition-all duration-300
                hover:brightness-110 hover:scale-[1.02]
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                overflow-hidden
              "
            >
              {/* shimmer */}
              <span
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)', transform: 'skewX(-20deg)' }}
              />
              <span className="relative flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '22px', fontFamily: 'serif', lineHeight: 1 }}>π</span>
                    <span>Sign in with Pi</span>
                  </>
                )}
              </span>
            </button>

            {statusMsg && (
              <p className={`text-sm font-medium text-center leading-relaxed ${statusMsg.isError ? 'text-red-400' : 'text-[#d4af37]'}`}>
                {statusMsg.text}
              </p>
            )}
          </div>

        ) : (
          /* ── بعد الـ Login ─────────────────────────────────── */
          <div className="flex flex-col gap-3">

            {/* User Card */}
            <div className="rounded-2xl border border-[#d4af3725] bg-[#0d0d14] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div style={{ background: 'linear-gradient(135deg,#d4af37,#b8882a)' }}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[#0a0800] text-lg">
                  {user.piUsername?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold">@{user.piUsername}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{user.role}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[#d4af37] font-bold text-lg">{balance}</p>
                  <p className="text-xs text-gray-500">TEC Balance</p>
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="
                w-full relative overflow-hidden
                bg-[#0a1f0f] border border-emerald-500/40
                hover:border-emerald-400 hover:bg-[#0f2e16]
                text-emerald-400 font-bold
                py-4 px-6 rounded-2xl
                text-sm uppercase tracking-widest
                transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg><span>Processing...</span></>
                ) : (
                  <><span>💎</span><span>Pay 1 π — Test</span></>
                )}
              </span>
            </button>

            {/* A2U Button */}
            <button
              onClick={handleA2U}
              className="
                w-full
                bg-[#0a0f1f] border border-blue-500/30
                hover:border-blue-400 hover:bg-[#0e1530]
                text-blue-400 font-bold
                py-4 px-6 rounded-2xl
                text-sm uppercase tracking-widest
                transition-all duration-300
              "
            >
              <span className="flex items-center justify-center gap-2">
                <span style={{ fontFamily: 'serif', fontSize: '18px' }}>π</span>
                <span>Receive 0.1 π (A2U)</span>
              </span>
            </button>

            {/* Messages */}
            {a2uMsg && (
              <p className={`text-sm text-center font-medium ${a2uMsg.isError ? 'text-red-400' : 'text-blue-400'}`}>
                {a2uMsg.text}
              </p>
            )}
            {statusMsg && (
              <p className={`text-sm text-center font-medium ${statusMsg.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {statusMsg.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
  }
