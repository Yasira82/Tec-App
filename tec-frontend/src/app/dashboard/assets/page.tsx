'use client';

import { useState, useEffect } from 'react';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';

interface Asset {
  id:            string;
  slug:          string;
  category:      'DOMAIN' | 'REAL_ESTATE' | 'DIGITAL_ASSET';
  status:        'ACTIVE' | 'PENDING' | 'LOCKED' | 'ON_SALE';
  metadata:      Record<string, unknown>;
  createdAt:     string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  DOMAIN:       '🌐',
  REAL_ESTATE:  '🏠',
  DIGITAL_ASSET:'💎',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  '#7ee7c0',
  PENDING: '#f0c040',
  LOCKED:  '#e74c3c',
  ON_SALE: '#7eb8f7',
};

export default function AssetsPage() {
  const { user, isAuthenticated } = usePiAuth();
  const [assets,    setAssets]    = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;
    const token = localStorage.getItem('tec_access_token');

    fetch(`/api/assets?userId=${user.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setAssets(d?.data ?? []))
      .catch(e => setError(`Failed to load assets: ${e}`))
      .finally(() => setIsLoading(false));
  }, [user?.id, isAuthenticated]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0 }}>Assets</h1>
        <p style={{ fontSize: 13, color: '#6b6b7a', marginTop: 4 }}>Your digital assets on Pi Network</p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#1f0505', border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Empty */}
      {assets.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a5a' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#6b6b7a' }}>No assets yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Assets you purchase will appear here</p>
        </div>
      )}

      {/* Assets List */}
      {assets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assets.map(asset => (
            <div key={asset.id}
              style={{ padding: '16px 20px', background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#d4af3710', border: '1px solid #d4af3720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, minWidth: 48 }}>
                {CATEGORY_EMOJI[asset.category] ?? '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.slug}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b7a' }}>
                  {asset.category.replace('_', ' ')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[asset.status], background: `${STATUS_COLOR[asset.status]}15`, border: `1px solid ${STATUS_COLOR[asset.status]}30`, padding: '3px 8px', borderRadius: 20, letterSpacing: 0.5 }}>
                  {asset.status}
                </span>
                <span style={{ fontSize: 10, color: '#4a4a5a' }}>
                  {new Date(asset.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
                      }
