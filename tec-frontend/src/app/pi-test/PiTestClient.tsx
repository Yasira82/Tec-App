'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPiBrowser, loginWithPi, getStoredUser, getAccessToken } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';
import { PiRuntime } from '@/lib-client/pi/PiRuntime';

type LogEntry = { ts: string; type: 'info' | 'success' | 'error' | 'warn'; msg: string };

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

type ServiceStatus = { name: string; status: 'checking' | 'ok' | 'error'; ms?: number };
type StreamHealth = {
  ok?: boolean; degraded?: boolean; redis?: string;
  missingGroups?: number; warnings?: number; checkedAt?: string; error?: string;
};

export function PiTestClient() {
  const [logs,           setLogs]           = useState<LogEntry[]>([]);
  const [authStatus,     setAuthStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payStatus,      setPayStatus]      = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [username,       setUsername]       = useState<string | null>(null);
  const [sdkReady,       setSdkReady]       = useState<boolean | null>(null);
  const [services,       setServices]       = useState<ServiceStatus[]>([]);
  const [checkingAll,    setCheckingAll]    = useState(false);
  const [streams,        setStreams]        = useState<StreamHealth | null>(null);
  const [checkingStreams,setCheckingStreams]= useState(false);

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

  // ── Consumer liveness (the nervous-system sensor, via BFF) ─────────────────
  const checkStreams = useCallback(async () => {
    setCheckingStreams(true);
    setStreams(null);
    log('info', 'Checking consumer liveness (event streams)...');
    try {
      const start = Date.now();
      const res   = await fetch('/api/health/streams', { cache: 'no-store' });
      const data  = await res.json() as StreamHealth;
      const ms    = Date.now() - start;
      setStreams(data);
      if (data.redis === 'unavailable') {
        log('warn', `Stream sensor unavailable (${ms}ms) — Redis unreachable or not configured`);
      } else {
        const verdict = data.ok ? 'success' : (data.missingGroups ? 'error' : 'warn');
        log(verdict, `Consumer liveness: ok=${data.ok} missing=${data.missingGroups ?? 0} warnings=${data.warnings ?? 0} (${ms}ms)`);
      }
    } catch (err) {
      log('error', `Stream check failed: ${String(err)}`);
    }
    setCheckingStreams(false);
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
      if (!isPiBrowser() || !PiRuntime.isAvailable()) throw new Error('Not inside Pi Browser');
      await window.Pi!.authenticate(['username', 'payments'], async (payment: unknown) => {
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
      const result = await createU2APayment(1, 'Test Payment from TEC Hub', { source: 'test' });
      if (result.success) {
        setPayStatus('done');
        log('success', `💰 Payment done: ${result.paymentId} | txid: ${result.txid}`);
      } else if (result.status === 'cancelled') {
        setPayStatus('cancelled');
        log('warn', 'Payment cancelled by user');
      } else {
        setPayStatus('error');
        log('error', `Payment failed: ${result.message ?? result.status}`);
      }
    } catch (err) {
      setPayStatus('error');
      log('error', `Payment error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [authStatus, log]);

  const col = (ok: boolean | null) => ok === null ? '#6b6b7a' : ok ? '#7ee7c0' : '#e74c3c';
  const statusDot = (ok: boolean | null) => (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: col(ok), marginRight: 6,
    }} />
  );

  const logColors: Record<LogEntry['type'], string> = {
    info: '#9898a8', success: '#7ee7c0', error: '#e74c3c', warn: '#f0c040',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050816', color: '#fff',
      fontFamily: 'monospace', padding: 24, maxWidth: 800, margin: '0 auto',
    }}>
      <h2 style={{ color: '#F8B820', marginBottom: 4 }}>🧪 TEC Pi Integration Test</h2>
      <p style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 24 }}>Developer diagnostics — not visible in production</p>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12 }}>{statusDot(sdkReady)} Pi SDK</span>
        <span style={{ fontSize: 12 }}>{statusDot(authStatus === 'done')} Auth {username ? `(@${username})` : ''}</span>
        <span style={{ fontSize: 12 }}>{statusDot(payStatus === 'done')} Payment</span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: '🔐 Authenticate',        fn: handleAuth,             disabled: authStatus === 'loading' },
          { label: '💳 Test Payment (1π)',  fn: handlePayment,          disabled: payStatus === 'loading' },
          { label: '📡 All Services',        fn: checkAllServices,       disabled: checkingAll },
          { label: '🫀 Consumer Liveness',   fn: checkStreams,           disabled: checkingStreams },
          { label: '🏥 BFF Health',          fn: handleCheckHealth,      disabled: false },
          { label: '🔄 SSO Test',            fn: handleCheckSSO,         disabled: false },
          { label: '⚠️ Cancel Pending',      fn: handleCancelPending,    disabled: false },
          { label: '🍪 Show Cookies',        fn: handleShowCookies,      disabled: false },
          { label: '👤 Show User',           fn: handleShowUser,         disabled: false },
          { label: '🧹 Clear Logs',          fn: () => setLogs([]),      disabled: false },
        ].map(({ label, fn, disabled }) => (
          <button key={label} onClick={fn} disabled={disabled} style={{
            padding: '8px 16px', borderRadius: 10,
            background: disabled ? '#1a1a2a' : '#ffffff15',
            border: '1px solid #ffffff15',
            color: disabled ? '#3a3a4a' : '#fff',
            fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 8 }}>SERVICES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {services.map(s => (
              <div key={s.name} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 8,
                background: s.status === 'ok' ? '#7ee7c020' : '#e74c3c20',
                border: `1px solid ${s.status === 'ok' ? '#7ee7c040' : '#e74c3c40'}`,
                color: s.status === 'ok' ? '#7ee7c0' : '#e74c3c',
              }}>
                {s.name} {s.ms !== undefined ? `${s.ms}ms` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consumer liveness (event-stream sensor) */}
      {streams && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 8 }}>
            CONSUMER LIVENESS {streams.checkedAt ? `· ${streams.checkedAt.slice(11, 19)}` : ''}
          </div>
          {streams.redis === 'unavailable' ? (
            <div style={{
              fontSize: 12, padding: '8px 12px', borderRadius: 8,
              background: '#f2c94c20', border: '1px solid #f2c94c40', color: '#f2c94c',
            }}>
              Sensor unavailable — Redis unreachable or not configured on identity-service.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['status',   streams.ok ? 'healthy' : streams.degraded ? 'degraded' : 'broken', streams.ok],
                ['missing groups', String(streams.missingGroups ?? 0), (streams.missingGroups ?? 0) === 0],
                ['lag/pending warnings', String(streams.warnings ?? 0), (streams.warnings ?? 0) === 0],
              ] as [string, string, boolean][]).map(([label, val, good]) => (
                <div key={label} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 8,
                  background: good ? '#7ee7c020' : '#e74c3c20',
                  border: `1px solid ${good ? '#7ee7c040' : '#e74c3c40'}`,
                  color: good ? '#7ee7c0' : '#e74c3c',
                }}>
                  {label}: {val}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log */}
      <div style={{
        background: '#0B1020', borderRadius: 12,
        border: '1px solid #ffffff10', padding: 16,
        maxHeight: 400, overflowY: 'auto',
        fontSize: 11, lineHeight: 1.6,
      }}>
        {logs.length === 0 && (
          <div style={{ color: '#3a3a4a' }}>No logs yet — run a test above.</div>
        )}
        {logs.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
            <span style={{ color: '#3a3a4a', flexShrink: 0 }}>{entry.ts}</span>
            <span style={{ color: logColors[entry.type], wordBreak: 'break-all' }}>{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
            }
