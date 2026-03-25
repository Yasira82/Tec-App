'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPi, getAccessToken, resolvePendingPayment, fetchWithAuth } from '@/lib-client/pi/pi-auth';
import { createA2UPayment } from '@/lib-client/pi/pi-payment';
import type { TecUser } from '@/types/pi.types';

const isSandboxMode = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';
const appId = process.env.NEXT_PUBLIC_PI_APP_ID;
const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
const missingEnvVars = isSandboxMode && (!appId || !gatewayUrl);

export default function PiPaymentButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<TecUser | null>(null);
  const [balance, setBalance] = useState<number | string>('...');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [a2uMsg, setA2uMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const setError = (text: string) => setStatusMsg({ text, isError: true });
  const setInfo  = (text: string) => setStatusMsg({ text, isError: false });
  const clearStatus = () => setStatusMsg(null);

  const fetchBalance = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/wallet/balance?userId=${userId}`);
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

      // ← Redirect للـ dashboard بعد الـ login
      router.push('/dashboard');

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = useCallback(async () => {
    if (!user) return;

    const token = getAccessToken();
    if (!token) {
      setError('Session expired. Please sign in again.');
      setUser(null);
      setBalance('...');
      return;
    }

    try {
      setLoading(true);
      setInfo('Processing payment...');

      const createRes = await fetchWithAuth('/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          amount: 1,
          currency: 'PI',
          payment_method: 'pi',
          metadata: { piUserId: user.piId },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to initiate payment');
      }

      const createData = await createRes.json();
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
                body: JSON.stringify({ payment_id: internalPaymentId, pi_payment_id: piPaymentId }),
              });
            } catch (err) {
              console.error('[TEC Payment] Approval error:', err);
            }
          },

          onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
            try {
              const completeRes = await fetchWithAuth('/api/payment/complete', {
                method: 'POST',
                body: JSON.stringify({ payment_id: internalPaymentId, transaction_id: txid }),
              });
              if (completeRes.ok) {
                setInfo('Payment successful! Balance updated.');
                setTimeout(() => fetchBalance(user.id), 2000);
              } else {
                setError('Payment completion failed. Please contact support.');
              }
            } catch (err) {
              console.error('[TEC Payment] Completion error:', err);
              setError('Network error during payment completion.');
            } finally {
              setLoading(false);
            }
          },

          onCancel: (_piPaymentId: string) => {
            setError('Payment cancelled.');
            setLoading(false);
          },

          onError: async (error: Error, payment?: unknown) => {
            console.error('[TEC Payment] Pi SDK error:', error);
            const msg = error?.message ?? '';
            const isPendingError =
              msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('already have');

            if (isPendingError) {
              const pendingPaymentId = (payment as { identifier?: string } | undefined)?.identifier;
              if (pendingPaymentId) {
                setInfo('Resolving pending payment, please wait...');
                const result = await resolvePendingPayment(pendingPaymentId);
                if (result) {
                  setInfo(`Pending payment resolved (${result.action}). Please tap Pay again.`);
                } else {
                  setError('Failed to resolve pending payment. Please try again later.');
                }
              } else {
                setError('A pending payment was detected. Please try again in a few moments.');
              }
            } else {
              setError('Payment error. Please try again.');
            }
            setLoading(false);
          },
        }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      setError(message);
      setLoading(false);
    }
  }, [user, fetchBalance]);

  const handleA2U = useCallback(async () => {
    if (!user) return;
    setA2uMsg(null);

    if (isSandboxMode) {
      setA2uMsg({ text: 'A2U is not available in Sandbox mode yet.', isError: false });
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setA2uMsg({ text: 'Session expired. Please sign in again.', isError: true });
      return;
    }

    try {
      setA2uMsg({ text: 'Processing A2U payment...', isError: false });
      await createA2UPayment({
        recipientUid: user.piId,
        amount: 0.001,
        memo: 'TEC A2U reward',
        metadata: { userId: user.id },
      });
      setA2uMsg({ text: 'A2U payment sent!', isError: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'A2U payment failed';
      setA2uMsg({ text: msg, isError: true });
    }
  }, [user]);

  if (missingEnvVars) {
    const missing: string[] = [];
    if (!appId) missing.push('NEXT_PUBLIC_PI_APP_ID');
    if (!gatewayUrl) missing.push('NEXT_PUBLIC_API_GATEWAY_URL');
    return (
      <div className="w-full max-w-md mx-auto text-center p-4">
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-300 text-left">
          <p className="font-semibold mb-2">⚠️ Sandbox configuration incomplete</p>
          <ul className="list-disc list-inside mb-2">
            {missing.map((v) => <li key={v}><code>{v}</code></li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {!user ? (
          <>
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-gradient-to-b from-[#d4af37] to-[#b8882a] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1208] font-bold py-5 px-8 rounded-lg transition duration-200 shadow-lg hover:shadow-xl text-xl tracking-widest uppercase"
            >
              <span className="flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-[#1a1208]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-serif leading-none">π</span>
                    <span>SIGN IN WITH PI</span>
                  </>
                )}
              </span>
            </button>
            {statusMsg && (
              <p className={`mt-4 text-sm font-medium leading-relaxed whitespace-pre-line ${statusMsg.isError ? 'text-red-400' : 'text-[#d4af37]'}`}>
                {statusMsg.text}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[#d4af37] font-semibold text-lg tracking-wide">
              Welcome, @{user.piUsername}!
            </p>
            <div className="bg-gray-900/60 p-4 rounded-2xl text-sm text-left border border-[#d4af37]/20 backdrop-blur-sm">
              <p className="text-gray-400 mb-1">
                <span className="text-gray-200 font-medium">Username: </span>
                <span className="text-[#d4af37] font-semibold">@{user.piUsername}</span>
              </p>
              <p className="text-gray-400 mb-1">
                <span className="text-gray-200 font-medium">User ID: </span>
                <span className="text-xs break-all text-gray-400">{user.id}</span>
              </p>
              {user.role && (
                <p className="text-gray-400 mb-1">
                  <span className="text-gray-200 font-medium">Role: </span>
                  <span className="text-xs text-blue-400 uppercase">{user.role}</span>
                </p>
              )}
              <p className="text-gray-400">
                <span className="text-gray-200 font-medium">TEC Balance: </span>
                <span className="font-bold text-lg text-[#d4af37] ml-1">{balance} TEC</span>
              </p>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-[#0a1f0f] via-[#0f2e16] to-[#0a1f0f] hover:from-[#0f2e16] hover:via-[#174021] hover:to-[#0f2e16] disabled:opacity-50 disabled:cursor-not-allowed text-emerald-400 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 border border-emerald-500/30 hover:border-emerald-500/60 text-base tracking-widest uppercase group"
            >
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Pay 1 Pi (Test)</span>
                )}
              </span>
            </button>

            <button
              onClick={handleA2U}
              className="w-full relative overflow-hidden bg-gradient-to-r from-[#0a0f1f] via-[#0e1530] to-[#0a0f1f] hover:from-[#0e1530] hover:via-[#152045] hover:to-[#0e1530] text-blue-400 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 border border-blue-500/30 hover:border-blue-500/60 text-base tracking-widest uppercase group"
            >
              <span className="relative flex items-center justify-center gap-2">
                <span className="text-xl font-serif leading-none">π</span>
                <span>Receive 0.1 Test-Pi (A2U)</span>
              </span>
            </button>

            {a2uMsg && (
              <p className={`text-sm font-medium leading-relaxed whitespace-pre-line ${a2uMsg.isError ? 'text-red-400' : 'text-blue-400'}`}>
                {a2uMsg.text}
              </p>
            )}
            {statusMsg && (
              <p className={`mt-2 text-sm font-medium leading-relaxed whitespace-pre-line ${statusMsg.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {statusMsg.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
