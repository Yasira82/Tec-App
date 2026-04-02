'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPiBrowser, loginWithPi, getStoredUser } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';

type LogEntry = { ts: string; type: 'info' | 'success' | 'error' | 'warn'; msg: string };

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

export function PiTestClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payStatus, setPayStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [username, setUsername] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState<boolean | null>(null);

  const log = useCallback((type: LogEntry['type'], msg: string) => {
    console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](`[Pi Test] ${msg}`);
    setLogs(prev => [...prev, { ts: timestamp(), type, msg }]);
  }, []);

  // Detect SDK readiness
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.__TEC_PI_READY) {
      setSdkReady(true);
      log('success', 'Pi SDK already initialised');
      return;
    }
    if (window.__TEC_PI_ERROR) {
      setSdkReady(false);
      log('error', 'Pi SDK failed to initialise');
      return;
    }

    let resolved = false;

    const onReady = () => {
      resolved = true;
      setSdkReady(true);
      log('success', 'Pi SDK initialised (tec-pi-ready event)');
    };
    const onError = () => {
      resolved = true;
      setSdkReady(false);
      log('error', 'Pi SDK init error (tec-pi-error event)');
    };

    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });

    const timer = setTimeout(() => {
      if (!resolved) {
        setSdkReady(false);
        log('warn', 'Pi SDK not ready after 5 s — are you inside Pi Browser?');
      }
    }, 5000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
      clearTimeout(timer);
    };
  }, [log]);

  // Restore stored user on mount
  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.piUsername) {
      setUsername(stored.piUsername);
      setAuthStatus('done');
      log('info', `Restored session: @${stored.piUsername}`);
    }
  }, [log]);

  const handleAuth = useCallback(async () => {
    log('info', 'Starting Pi authentication…');
    setAuthStatus('loading');
    try {
      if (!isPiBrowser()) {
        throw new Error('Not inside Pi Browser — window.Pi is unavailable');
      }
      const result = await loginWithPi();
      setUsername(result.user.piUsername);
      setAuthStatus('done');
      log('success', `Authenticated as @${result.user.piUsername} (uid: ${result.user.piId})`);
    } catch (err) {
      setAuthStatus('error');
      log('error', `Auth error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [log]);

  const handlePayment = useCallback(async () => {
    if (authStatus !== 'done') {
      log('warn', 'Authenticate first before testing payment');
      return;
    }
    log('info', 'Creating payment (amount: 0.001 Pi, memo: "TEC sandbox test")…');
    setPayStatus('loading');

    const onDiagnostic = (type: string, message: string, data?: unknown) => {
      const entry = data ? `${message} — ${JSON.stringify(data)}` : message;
      log(
        type === 'error' ? 'error' : type === 'cancel' ? 'warn' : 'info',
        `[${type.toUpperCase()}] ${entry}`,
      );
    };

    try {
      const result = await createU2APayment(
        0.001,
        'TEC sandbox test',
        { source: 'pi-test-page' },
        onDiagnostic,
      );

      if (result.status === 'cancelled') {
        setPayStatus('cancelled');
        log('warn', `Payment cancelled by user (id: ${result.paymentId ?? 'n/a'})`);
      } else {
        setPayStatus('done');
        log('success', `Payment completed! id=${result.paymentId} txid=${result.txid}`);
      }
    } catch (err) {
      setPayStatus('error');
      log('error', `Payment error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [authStatus, log]);

  const clearLogs = () => setLogs([]);

  return (
    <main style={{ fontFamily: 'monospace', maxWidth: 760, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>🥧 Pi Sandbox Test Page</h1>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 24 }}>
        Verify Pi auth + payment callbacks end-to-end. Open this page inside{' '}
        <strong>Pi Browser</strong> to exercise the live SDK.
      </p>

      {/* SDK status */}
      <div
        style={{
          marginBottom: 20,
          padding: '10px 14px',
          borderRadius: 6,
          background: sdkReady === null ? '#f5f5f5' : sdkReady ? '#e6f9ee' : '#fff0f0',
          border: '1px solid ' + (sdkReady === null ? '#ddd' : sdkReady ? '#6dd68e' : '#f99'),
        }}
      >
        <strong>SDK status:</strong>{' '}
        {sdkReady === null ? '⏳ waiting…' : sdkReady ? '✅ ready' : '❌ unavailable'}
        <span style={{ marginLeft: 16, color: '#888', fontSize: '0.8rem' }}>
          appId: {process.env.NEXT_PUBLIC_PI_APP_ID ?? '(not set)'} | sandbox:{' '}
          {process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'true'}
        </span>
      </div>

      {/* Auth section */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>1. Authentication</h2>
        <button
          onClick={handleAuth}
          disabled={authStatus === 'loading'}
          style={{
            padding: '8px 18px',
            marginRight: 10,
            cursor: authStatus === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {authStatus === 'loading' ? 'Authenticating…' : 'Authenticate with Pi'}
        </button>
        {username && (
          <span style={{ color: '#2a9a4e' }}>✅ Logged in as <strong>@{username}</strong></span>
        )}
        {authStatus === 'error' && (
          <span style={{ color: '#c0392b' }}>❌ Auth failed — see logs below</span>
        )}
      </section>

      {/* Payment section */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>2. Payment (0.001 Pi)</h2>
        <button
          onClick={handlePayment}
          disabled={authStatus !== 'done' || payStatus === 'loading'}
          style={{
            padding: '8px 18px',
            cursor: authStatus !== 'done' || payStatus === 'loading' ? 'not-allowed' : 'pointer',
            opacity: authStatus !== 'done' ? 0.5 : 1,
          }}
        >
          {payStatus === 'loading' ? 'Processing…' : 'Pay 0.001 Pi (test)'}
        </button>
        {payStatus === 'done' && <span style={{ marginLeft: 12, color: '#2a9a4e' }}>✅ Payment complete!</span>}
        {payStatus === 'cancelled' && <span style={{ marginLeft: 12, color: '#e67e22' }}>⚠️ Cancelled</span>}
        {payStatus === 'error' && <span style={{ marginLeft: 12, color: '#c0392b' }}>❌ Error — see logs</span>}
      </section>

      {/* Logs */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 12 }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Logs</h2>
          <button onClick={clearLogs} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Clear</button>
        </div>
        <div
          style={{
            background: '#1a1a1a',
            color: '#eee',
            padding: 14,
            borderRadius: 6,
            minHeight: 120,
            maxHeight: 400,
            overflowY: 'auto',
            fontSize: '0.78rem',
            lineHeight: 1.6,
          }}
        >
          {logs.length === 0 ? (
            <span style={{ color: '#888' }}>— no events yet —</span>
          ) : (
            logs.map((e, i) => (
              <div
                key={i}
                style={{
                  color:
                    e.type === 'error' ? '#ff6b6b' :
                    e.type === 'warn'  ? '#ffd93d' :
                    e.type === 'success' ? '#6bcb77' : '#ddd',
                }}
              >
                <span style={{ color: '#888' }}>{e.ts}</span> {e.msg}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
        }
