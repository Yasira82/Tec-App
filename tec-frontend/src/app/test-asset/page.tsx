'use client';

import { useState } from 'react';

export default function TestAssetPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('tec_access_token') ?? '';
  const getUserId = () => {
    try {
      return JSON.parse(localStorage.getItem('tec_user') ?? '{}')?.id ?? '';
    } catch { return ''; }
  };

  // ── Test 1: Get user assets ───────────────────────────
  const testGetAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets?userId=${getUserId()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally { setLoading(false); }
  };

  // ── Test 2: Provision asset ───────────────────────────
  const testProvision = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId:        getUserId(),
          transactionId: `test-tx-${Date.now()}`,
          slug:          `test-asset-${Date.now()}`,
          category:      'DOMAIN',
          metadata:      { extension: '.pi', test: true },
        }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally { setLoading(false); }
  };

  // ── Test 3: Get asset by slug ─────────────────────────
  const [slug, setSlug] = useState('');
  const testGetBySlug = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
      const res = await fetch(`${GATEWAY}/api/assets/assets/${slug}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally { setLoading(false); }
  };

  const btnStyle = (color: string) => ({
    padding: '12px 20px',
    background: `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 12,
    color,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#d4af37', marginBottom: 24 }}>
        🧪 Asset Service Test
      </h1>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <button style={btnStyle('#7ee7c0')} onClick={testGetAssets}>
          📦 GET My Assets
        </button>

        <button style={btnStyle('#d4af37')} onClick={testProvision}>
          ➕ Provision Test Asset (DOMAIN)
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="Enter slug e.g. test.pi"
            style={{ flex: 1, padding: '10px 14px', background: '#0d0d14', border: '1px solid #ffffff20', borderRadius: 10, color: '#fff', fontSize: 13 }}
          />
          <button style={btnStyle('#7eb8f7')} onClick={testGetBySlug}>
            🔍 Get by Slug
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: '#d4af37', fontSize: 13, marginBottom: 12 }}>⏳ Loading...</div>
      )}

      {/* Result */}
      {result && (
        <div style={{ background: '#0d0d14', border: '1px solid #ffffff10', borderRadius: 14, padding: '16px', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#6b6b7a', letterSpacing: 1 }}>RESPONSE</span>
            <button
              onClick={() => setResult('')}
              style={{ background: 'none', border: 'none', color: '#6b6b7a', cursor: 'pointer', fontSize: 12 }}>
              ✕ Clear
            </button>
          </div>
          <pre style={{ fontSize: 11, color: '#7ee7c0', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
