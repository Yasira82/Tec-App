'use client';

// "My TEC" — a shareable snapshot card. Reuses the Hub card visual language but its
// job is MARKETING: turn a real member snapshot into a one-tap share that feeds the
// Founding 100 funnel (/pioneers). Native share sheet where available (Pi Browser /
// mobile), clipboard-copy fallback. Honesty: only REAL numbers are shared — the live
// asset count + the live-apps count. The private Pi balance is never shared.
import { useState, useCallback } from 'react';
import { haptic } from '@/lib/hub/utils';

interface Props {
  assetCount: number | null;
  liveApps:   number;
}

const PIONEERS_URL = 'https://hub.tecosystem.app/pioneers';

export function HubShareCard({ assetCount, liveApps }: Props) {
  const [shared, setShared] = useState(false);

  const onShare = useCallback(async () => {
    haptic('light');
    const parts = ["I'm on TEC — a full economy on Pi"];
    if (assetCount != null && assetCount > 0) parts.push(`${assetCount} assets`);
    parts.push(`${liveApps} apps, one Pi identity`);
    const text = `${parts.join(' · ')}. Join the Founding 100:`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'TEC — Founding 100', text, url: PIONEERS_URL });
        return;
      }
    } catch { /* user cancelled or unsupported — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(`${text} ${PIONEERS_URL}`);
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch { /* clipboard blocked — nothing to do */ }
  }, [assetCount, liveApps]);

  return (
    <div style={{ padding: '16px 16px 0', animation: 'tec-fade-in 0.6s ease both' }}>
      <button
        className="tec-btn"
        onClick={onShare}
        aria-label="Share your TEC"
        style={{
          width: '100%', borderRadius: 20, textAlign: 'left', cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12), #111627)',
          border: '1px solid rgba(139,92,246,0.28)', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'linear-gradient(135deg,#1e1440,#111627)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>★</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 3 }}>Share your TEC</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
              {(assetCount != null && assetCount > 0) ? `${assetCount} assets · ` : ''}{liveApps} apps · invite to the Founding 100
            </div>
          </div>
        </div>
        <span
          style={{
            flex: '0 0 auto', fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
            color: shared ? '#22C55E' : '#0d0616',
            background: shared ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#C4B5FD,#8B5CF6)',
            border: shared ? '1px solid rgba(34,197,94,0.5)' : 'none',
            borderRadius: 999, padding: '9px 16px', whiteSpace: 'nowrap',
          }}
        >
          {shared ? 'Copied ✓' : '↗ Share'}
        </span>
      </button>
    </div>
  );
}
