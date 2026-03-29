client';

import { useState, useEffect, useCallback } from 'react';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { useRouter } from 'next/navigation';

interface Listing {
  id:          string;
  price:       number;
  currency:    string;
  title:       string | null;
  description: string | null;
  sellerId:    string;
  createdAt:   string;
  asset: {
    slug:     string;
    category: string;
    metadata: Record<string, unknown>;
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  DOMAIN:        '🌐',
  REAL_ESTATE:   '🏠',
  DIGITAL_ASSET: '💎',
};

const s = (style: React.CSSProperties) => style;

export default function MarketplacePage() {
  const { user } = usePiAuth();
  const router   = useRouter();
  const [listings,    setListings]    = useState<Listing[]>([]);
  const [total,       setTotal]       = useState(0);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing,setIsRefreshing]= useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [buying,      setBuying]      = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  const fetchListings = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/marketplace');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(`Failed to load marketplace: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  if (isLoading) {
    return (
      <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' })}>
        <div style={s({ width: 36, height: 36, border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={s({ padding: '24px 16px', maxWidth: 600, margin: '0 auto' })}>

      {/* Header */}
      <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 })}>
        <div>
          <h1 style={s({ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 })}>Marketplace</h1>
          <p style={s({ fontSize: 13, color: '#6b6b7a', marginTop: 4 })}>{total} assets for sale</p>
        </div>
        <button onClick={() => fetchListings(true)} disabled={isRefreshing}
          style={s({ background: '#d4af3715', border: '1px solid #d4af3730', borderRadius: 10, padding: '8px 14px', color: '#d4af37', fontSize: 12, fontWeight: 600, cursor: 'pointer' })}>
          {isRefreshing ? '⟳ ...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={s({ padding: '12px 16px', borderRadius: 12, background: '#1f0505', border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 13, marginBottom: 16 })}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={s({ padding: '12px 16px', borderRadius: 12, background: '#051a0a', border: '1px solid #7ee7c030', color: '#7ee7c0', fontSize: 13, marginBottom: 16 })}>
          ✅ {success}
        </div>
      )}

      {/* Sell Your Asset CTA */}
      <button onClick={() => router.push('/dashboard/assets')}
        style={s({ width: '100%', padding: '14px', borderRadius: 16, background: 'linear-gradient(135deg,#1a1208,#0d0d14)', border: '1px solid #d4af3730', color: '#d4af37', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 })}>
        <span>💎</span>
        <span>List Your Asset for Sale</span>
        <span>→</span>
      </button>

      {/* Empty State */}
      {listings.length === 0 && !error && (
        <div style={s({ textAlign: 'center', padding: '60px 20px', background: '#0d0d14', border: '1px solid #ffffff08', borderRadius: 18 })}>
          <div style={s({ fontSize: 48, marginBottom: 16 })}>🏪</div>
          <p style={s({ fontSize: 16, fontWeight: 600, color: '#6b6b7a' })}>No listings yet</p>
          <p style={s({ fontSize: 13, color: '#4a4a5a', marginTop: 4 })}>Be the first to list an asset</p>
        </div>
      )}

      {/* Listings */}
      {listings.length > 0 && (
        <div style={s({ display: 'flex', flexDirection: 'column', gap: 12 })}>
          {listings.map(listing => {
            const isOwn    = listing.sellerId === user?.id;
            const isBuying = buying === listing.id;
            const emoji    = CATEGORY_EMOJI[listing.asset.category] ?? '📦';

            return (
              <div key={listing.id}
                style={s({ background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, padding: '16px 20px' })}>
                <div style={s({ display: 'flex', alignItems: 'center', gap: 14 })}>
                  <div style={s({ width: 48, height: 48, borderRadius: 14, background: '#d4af3710', border: '1px solid #d4af3720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, minWidth: 48 })}>
                    {emoji}
                  </div>
                  <div style={s({ flex: 1, minWidth: 0 })}>
                    <div style={s({ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                      {listing.title ?? listing.asset.slug}
                    </div>
                    <div style={s({ fontSize: 11, color: '#6b6b7a', marginTop: 2 })}>
                      {listing.asset.category.replace(/_/g, ' ')} · {listing.asset.slug}
                    </div>
                    {listing.description && (
                      <div style={s({ fontSize: 11, color: '#4a4a5a', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                        {listing.description}
                      </div>
                    )}
                  </div>
                  <div style={s({ textAlign: 'right', minWidth: 80 })}>
                    <div style={s({ fontSize: 20, fontWeight: 900, color: '#d4af37' })}>{listing.price}</div>
                    <div style={s({ fontSize: 10, color: '#4a4a5a' })}>π</div>
                  </div>
                </div>

                {!isOwn && (
                  <button
                    disabled={!!buying}
                    onClick={async () => {
                      setBuying(listing.id);
                      setSuccess(null);
                      setError(null);
                      // TODO: trigger Pi payment then call /buy
                      setTimeout(() => {
                        setBuying(null);
                        setError('Pi payment integration required — coming soon');
                      }, 1000);
                    }}
                    style={s({
                      width: '100%', marginTop: 12, padding: '10px',
                      borderRadius: 10,
                      background: isBuying ? '#7ee7c020' : 'linear-gradient(135deg,#0d2e14,#0a1f0f)',
                      border: `1px solid ${isBuying ? '#7ee7c030' : '#7ee7c040'}`,
                      color: '#7ee7c0', fontSize: 12, fontWeight: 700,
                      cursor: buying ? 'not-allowed' : 'pointer',
                    })}>
                    {isBuying ? '⏳ Processing...' : `Buy for ${listing.price} π`}
                  </button>
                )}

                {isOwn && (
                  <div style={s({ marginTop: 12, padding: '8px 14px', borderRadius: 10, background: '#d4af3710', border: '1px solid #d4af3720', fontSize: 11, color: '#d4af37', textAlign: 'center' })}>
                    Your listing
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
      }
