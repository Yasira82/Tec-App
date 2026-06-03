'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPiBrowser, loginWithPi, getStoredUser, getAccessToken } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';

type LogEntry = { ts: string; type: 'info' | 'success' | 'error' | 'warn'; msg: string };

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

type ServiceStatus = { name: string; status: 'checking' | 'ok' | 'error'; ms?: number };

export function PiTestClient() {
  const [logs,           setLogs]           = useState<LogEntry[]>([]);
  const [authStatus,     setAuthStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payStatus,      setPayStatus]      = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [username,       setUsername]       = useState<string | null>(null);
  const [sdkReady,       setSdkReady]       = useState<boolean | null>(null);
  const [services,       setServices]       = useState<ServiceStatus[]>([]);
  const [checkingAll,    setCheckingAll]    = useState(false);

  const log = useCallback((type: LogEntry['type'], msg: string) => {
    setLogs(prev => [...prev, { ts: timestamp(), type, msg }]);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__TEC_PI_READY) { setSdkReady(true); log('success', 'Pi SDK already initialised'); return; }
    if (window.__TEC_PI_ERROR) { setSdkReady(false); log('error', 'Pi SDK failed to initialise'); return; }

    let resolved = false;
    const onReady = () => { resolved = true; setSdkReady(true); log('success', 'Pi SDK initialised'); };
    const onError = () => { resolved = true; setSdkReady(false); log('error', 'Pi SDK init error'); };

    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });

    const timer = setTimeout(() => {
      if (!resolved) { setSdkReady(false); log('warn', 'Pi SDK not ready after 5s'); }
    }, 5000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
      clearTimeout(timer);
    };
  }, [log]);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.piUsername) {
      setUsername(stored.piUsername);
      setAuthStatus('done');
      log('info', `Restored session: @${stored.piUsername}`);
    }
  }, [log]);

  // ── Services Health Check (via BFF — no direct Railway URLs in browser) ────
  const checkAllServices = useCallback(async () => {
    setCheckingAll(true);
    setServices([]);
    log('info', 'Checking services via BFF...');
    try {
      const start = Date.now();
      const res   = await fetch('/api/health/services', { cache: 'no-store' });
      const data  = await res.json() as { ok: boolean; services?: ServiceStatus[] };
      const ms    = Date.now() - start;
      if (data.services) {
        setServices(data.services.map(s => ({ ...s, status: s.status as ServiceStatus['status'] })));
      }
      log(data.ok ? 'success' : 'warn', `Services check done (${ms}ms)`);
    } catch (err) {
      log('error', `Services check failed: ${String(err)}`);
    }
    setCheckingAll(false);
  }, [log]);

  // ── Auth Test ─────────────────────────────────────────────
  const handleCheckAuthService = useCallback(async () => {
    log('info', 'Testing auth service via BFF...');
    try {
      const start = Date.now();
      const res   = await fetch('/api/health', { cache: 'no-store' });
      const data  = await res.json();
      const ms    = Date.now() - start;
      log(res.ok ? 'success' : 'error', `BFF Health: ${JSON.stringify(data)} (${ms}ms)`);
    } catch (err) {
      log('error', `BFF Health failed: ${String(err)}`);
    }
  }, [log]);

  // ── SSO Test ─────────────────────────────────────────────
  const handleCheckSSO = useCallback(async () => {
    log('info', 'Testing SSO endpoint...');
    try {
      const res = await fetch('/api/auth/sso?target=https://assets.tecosystem.app', {
        credentials: 'include', redirect: 'manual',
      });
      log(res.status === 302 || res.status === 307 ? 'success' : 'warn',
        `SSO response: ${res.status} ${res.statusText}`);
    } catch (err) {
      log('error', `SSO test failed: ${String(err)}`);
    }
  }, [log]);

  const handleAuth = useCallback(async () => {
    log('info', 'Starting Pi authentication…');
    setAuthStatus('loading');
    try {
      if (!isPiBrowser()) throw new Error('Not inside Pi Browser');
      const result = await loginWithPi();
      setUsername(result.user.piUsername);
      setAuthStatus('done');
      log('success', `Authenticated as @${result.user.piUsername} (uid: ${result.user.piId})`);
    } catch (err) {
      setAuthStatus('error');
      log('error', `Auth error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [log]);

  const handleShowCookies = useCallback(() => {
    const cookies = document.cookie.split('; ').reduce((acc, c) => {
      const [k, ...rest] = c.split('=');
      const v = rest.join('=');
      acc[k] = k.includes('token') || k.includes('csrf') ? v?.slice(0, 30) + '...' : v;
      return acc;
    }, {} as Record<string, string>);
    log('info', `🍪 Cookies: ${JSON.stringify(cookies, null, 2)}`);
  }, [log]);

  const handleShowUser = useCallback(() => {
    const user  = getStoredUser();
    const token = getAccessToken();
    log('info', `👤 User: ${JSON.stringify(user, null, 2)}`);
    log('info', `🔑 Token: ${!!token} | ${token?.slice(0, 20) ?? 'N/A'}...`);
  }, [log]);

  const handleCheckHealth = useCallback(async () => {
    log('info', 'Checking BFF health...');
    try {
      const res  = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      log(res.ok ? 'success' : 'error', `🏥 Health: ${JSON.stringify(data)}`);
    } catch (err) {
      log('error', `Health check failed: ${String(err)}`);
    }
  }, [log]);

  const handleCancelPending = useCallback(async () => {
    log('info', 'Checking for pending payments...');
    try {
      if (!isPiBrowser() || !window.Pi) throw new Error('Not inside Pi Browser');
      await window.Pi.authenticate(['username', 'payments'], async (payment: unknown) => {
        const p   = payment as Record<string, unknown> | null;
        const pid = p?.identifier as string | undefined;
        if (!pid) { log('info', 'No pending payment ✅'); return; }
        log('warn', `Pending: ${pid} | amount: ${p?.amount}`);
        const token     = getAccessToken();
        const csrfToken = document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1];
        const headers: Record<string, string> = {};
        if (token)     headers['Authorization'] = `Bearer ${token}`;
        if (csrfToken) headers['x-csrf-token']  = csrfToken;
        try {
          const res  = await fetch(`/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(pid)}`, {
            method: 'POST', credentials: 'include', headers,
          });
          const data = await res.json().catch(() => ({}));
          log(res.ok ? 'success' : 'error', `Resolve: ${JSON.stringify(data)} (${res.status})`);
        } catch (e) { log('error', `Network: ${String(e)}`); }
      });
    } catch (err) { log('error', `Failed: ${String(err)}`); }
  }, [log]);

  const handlePayment = useCallback(async () => {
    if (authStatus !== 'done') { log('warn', 'Authenticate first'); return; }
    log('info', 'Creating payment (1π)…');
    setPayStatus('loading');
    try {
      const result = await createU2APayment(1, 'TEC sandbox test', { source: 'pi-test-page' });
      if (result.status === 'cancelled') {
        setPayStatus('cancelled');
        log('warn', `Cancelled (id: ${result.paymentId ?? 'n/a'})`);
      } else {
        setPayStatus('done');
        log('success', `✅ Done! id=${result.paymentId} txid=${result.txid}`);
      }
    } catch (err) {
      setPayStatus('error');
      log('error', `Payment error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [authStatus, log]);

  const clearLogs = () => setLogs([]);

  const btn = (color = '#333'): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 6, border: 'none',
    background: color, color: '#fff', cursor: 'pointer',
    fontSize: '0.82rem', fontWeight: 600,
  });

  return (
    <main style={{ fontFamily: 'monospace', maxWidth: 800, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>🥧 TEC Diagnostic Page</h1>
      <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: 20 }}>
        Open inside <strong>Pi Browser</strong> · appId: <code>{process.env.NEXT_PUBLIC_PI_APP_ID ?? '(not set)'}</code>
      </p>

      {/* SDK Status */}
      <div style={{
        marginBottom: 16, padding: '10px 14px', borderRadius: 6,
        background: sdkReady === null ? '#f5f5f5' : sdkReady ? '#e6f9ee' : '#fff0f0',
        border: '1px solid ' + (sdkReady === null ? '#ddd' : sdkReady ? '#6dd68e' : '#f99'),
      }}>
        <strong>Pi SDK:</strong>{' '}
        {sdkReady === null ? '⏳ waiting…' : sdkReady ? '✅ ready' : '❌ unavailable'}
        <span style={{ marginLeft: 12, color: '#888', fontSize: '0.78rem' }}>
          sandbox: {process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'true'}
        </span>
      </div>

      {/* ── Services Status ── */}
      <section style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #e74c3c', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: '1rem', margin: 0, color: '#e74c3c' }}>🛰️ Services Health (12)</h2>
          <button onClick={checkAllServices} disabled={checkingAll} style={btn('#e74c3c')}>
            {checkingAll ? 'Checking...' : 'Check All Services'}
          </button>
        </div>
        {services.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {services.map(s => (
              <div key={s.name} style={{
                padding: '6px 10px', borderRadius: 6, fontSize: '0.78rem',
                background: s.status === 'ok' ? '#e6f9ee' : s.status === 'error' ? '#fff0f0' : '#f5f5f5',
                border: '1px solid ' + (s.status === 'ok' ? '#6dd68e' : s.status === 'error' ? '#f99' : '#ddd'),
              }}>
                <span>{s.status === 'ok' ? '✅' : s.status === 'error' ? '❌' : '⏳'}</span>{' '}
                <strong>{s.name}</strong>
                {s.ms !== undefined && <span style={{ color: '#888', marginLeft: 4 }}>{s.ms}ms</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Debug Tools ── */}
      <section style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #3498db', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 10, color: '#3498db' }}>🔍 Debug Tools</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleShowCookies}      style={btn('#3498db')}>🍪 Cookies</button>
          <button onClick={handleShowUser}         style={btn('#8e44ad')}>👤 User</button>
          <button onClick={handleCheckHealth}      style={btn('#27ae60')}>🏥 BFF Health</button>
          <button onClick={handleCheckAuthService} style={btn('#16a085')}>🔐 Auth Test</button>
          <button onClick={handleCheckSSO}         style={btn('#d35400')}>🔄 SSO Test</button>
        </div>
      </section>

      {/* ── Auth ── */}
      <section style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #2c3e50', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>1. Authentication</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleAuth} disabled={authStatus === 'loading'} style={btn('#2c3e50')}>
            {authStatus === 'loading' ? 'Authenticating…' : 'Authenticate with Pi'}
          </button>
          {username          && <span style={{ color: '#2a9a4e' }}>✅ @{username}</span>}
          {authStatus === 'error' && <span style={{ color: '#c0392b' }}>❌ Auth failed</span>}
        </div>
      </section>

      {/* ── Pending Payments ── */}
      <section style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #e67e22', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 8, color: '#e67e22' }}>⚠️ Pending Payments</h2>
        <button onClick={handleCancelPending} style={btn('#e67e22')}>Check & Resolve</button>
      </section>

      {/* ── Payment Test ── */}
      <section style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #8e44ad', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>2. Payment Test (1π)</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handlePayment}
            disabled={authStatus !== 'done' || payStatus === 'loading'}
            style={{ ...btn('#8e44ad'), opacity: authStatus !== 'done' ? 0.5 : 1 }}>
            {payStatus === 'loading' ? 'Processing…' : 'Pay 1π (test)'}
          </button>
          {payStatus === 'done'      && <span style={{ color: '#2a9a4e' }}>✅ Complete!</span>}
          {payStatus === 'cancelled' && <span style={{ color: '#e67e22' }}>⚠️ Cancelled</span>}
          {payStatus === 'error'     && <span style={{ color: '#c0392b' }}>❌ Error</span>}
        </div>
      </section>

      {/* ── Logs ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 12 }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>📋 Logs ({logs.length})</h2>
          <button onClick={clearLogs} style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer' }}>Clear</button>
        </div>
        <div style={{
          background: '#1a1a1a', color: '#eee', padding: 14, borderRadius: 6,
          minHeight: 120, maxHeight: 500, overflowY: 'auto',
          fontSize: '0.76rem', lineHeight: 1.7,
        }}>
          {logs.length === 0 ? (
            <span style={{ color: '#888' }}>— no events yet —</span>
          ) : (
            logs.map((e, i) => (
              <div key={i} style={{
                color: e.type === 'error'   ? '#ff6b6b'
                     : e.type === 'warn'    ? '#ffd93d'
                     : e.type === 'success' ? '#6bcb77'
                     : '#ddd',
                borderBottom: '1px solid #2a2a2a', paddingBottom: 2, marginBottom: 2,
              }}>
                <span style={{ color: '#888' }}>{e.ts}</span>{' '}{e.msg}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
        }