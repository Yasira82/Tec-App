'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePiAuth }      from '@/lib-client/hooks/usePiAuth';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { sessionToken } from '@/lib-client/pi/session-source';

interface Asset {
  id:        string;
  slug:      string;
  /** Service-defined — NOT a closed set. 'NFT' is returned too, and anything new
   *  must still render rather than fall through as an uncounted, unlabeled row. */
  category:  string;
  status:    'ACTIVE' | 'PENDING' | 'LOCKED' | 'ON_SALE';
  metadata:  Record<string, unknown>;
  createdAt: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  DOMAIN:        '🌐',
  REAL_ESTATE:   '🏠',
  DIGITAL_ASSET: '💎',
  NFT:           '🖼️',
};

/** Human name for an asset. The service puts it in metadata; the page used to print
 *  `slug`, so every NFT showed as "nft-cbc4bb46-…" instead of the name its owner gave it. */
function assetName(a: Asset): string {
  const m = a.metadata ?? {};
  for (const k of ['name', 'title', 'nftName']) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return a.slug;
}

/** NFT artwork, when the service stored one (tec-assets writes `metadata.imageUrl`). */
function assetImage(a: Asset): string | null {
  const m = a.metadata ?? {};
  for (const k of ['imageUrl', 'image_url', 'image', 'url']) {
    const v = m[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  return null;
}

/**
 * Asset thumbnail — the NFT artwork, falling back to the category icon.
 *
 * The fallback must RENDER something: an earlier version hid the broken <img>, which
 * left an empty black square (every tile, because the Hub's CSP was blocking r2.dev).
 * A failed image now returns the tile to the icon it would have shown anyway.
 */
function AssetThumb({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false);
  const src   = assetImage(asset);
  const emoji = CATEGORY_EMOJI[(asset.category ?? '').toUpperCase()] ?? '📦';

  return (
    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F8B82010', border: '1px solid #F8B82020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, minWidth: 48, overflow: 'hidden' }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={assetName(asset)} width={48} height={48} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailed(true)} />
      ) : emoji}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  '#7ee7c0',
  PENDING: '#f0c040',
  LOCKED:  '#e74c3c',
  ON_SALE: '#7eb8f7',
};

export default function AssetsPage() {
  const { user, isAuthenticated } = usePiAuth();
  const [assets,       setAssets]       = useState<Asset[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchAssets = useCallback(async (silent = false) => {
    if (!user?.id || !isAuthenticated) return;
    // ✅ VM-004: cookie بدل localStorage
    const token = sessionToken();
    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets?userId=${user.id}`, {
        credentials: 'include',
        headers:     token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setAssets(d?.data ?? []);
    } catch (e) {
      setError(`Failed to load assets: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, isAuthenticated]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // Every category actually present, biggest first — so the totals always add up to
  // the list below and a new service category can never go silently uncounted.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach(a => {
      const cat = (a.category ?? 'OTHER').toUpperCase();
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [assets]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F8B82030', borderTop: '2px solid #F8B820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0 }}>Assets</h1>
          <p style={{ fontSize: 13, color: '#6b6b7a', marginTop: 4 }}>Your digital assets on Pi Network</p>
        </div>
        <button
          onClick={() => fetchAssets(true)}
          disabled={isRefreshing}
          style={{ background: '#F8B82015', border: '1px solid #F8B82030', borderRadius: 10, padding: '8px 14px', color: '#F8B820', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {isRefreshing ? '⟳ ...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Stats — derived from the assets actually held, NOT a fixed list of three
          categories. The old version counted only DOMAIN/REAL_ESTATE/DIGITAL_ASSET,
          so a wallet of 48 NFTs displayed "1 / 0 / 0" above a list of 48. */}
      {categoryCounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(categoryCounts.length, 3)}, 1fr)`, gap: 10, marginBottom: 20 }}>
          {categoryCounts.map(([cat, count]) => (
            <div key={cat} style={{ padding: '12px', background: '#0B1020', border: '1px solid #ffffff08', borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{CATEGORY_EMOJI[cat] ?? '📦'}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F8B820' }}>{count}</div>
              <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 0.5 }}>
                {cat.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#1f0505', border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Empty */}
      {assets.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#6b6b7a' }}>No assets yet</p>
          <p style={{ fontSize: 13, color: '#4a4a5a', marginTop: 4 }}>Assets you purchase will appear here</p>
        </div>
      )}

      {/* Assets List */}
      {assets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            {assets.length} Asset{assets.length !== 1 ? 's' : ''}
          </div>
          {assets.map(asset => (
            <div key={asset.id}
              style={{ padding: '16px 20px', background: '#0B1020', border: '1px solid #F8B82020', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
              <AssetThumb asset={asset} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Wrap to a second line instead of clipping: every NFT in a series
                    shares a prefix ("TEC Genesis — …"), so a single clipped line made
                    all 47 of them read identically. */}
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 3, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                  {assetName(asset)}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b7a' }}>
                  {(asset.category ?? 'ASSET').replace(/_/g, ' ')}
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
