'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter }     from 'next/navigation';
import { haptic }        from '@/lib/hub/utils';
import { HubApp }        from '@/lib/hub/types';
import { appAccentRgba } from '@/lib/hub/appAccent';

interface Props {
  apps: HubApp[];
}

const FAV_KEY    = 'tec_fav_apps';
const RECENT_KEY = 'tec_recent_apps';
const RECENT_MAX = 6;

// User-facing app categories — grounded in the KB Economic OS Model (C-119) + the app
// charters (C-105→C-131), NOT the registry's coarse `group` field (which mis-placed
// e.g. Zone under "social" — it is the Verification Runtime, C-120). Each app once.
const CATEGORY_OF: Record<string, string> = {
  // Money & Commerce — trade, ownership, capital, protection
  commerce: 'money', ecommerce: 'money', assets: 'money', fundx: 'money', insure: 'money',
  // Business & Work — build, enterprise, opportunities, developers
  nbf: 'work', titan: 'work', nx: 'work', epic: 'work', dx: 'work',
  // Real World — property, institutional assets, discovery
  estate: 'realworld', brookfield: 'realworld', explorer: 'realworld',
  // Identity & Social — personal + relationships
  life: 'social', connection: 'social',
  // Reputation — evidence → recognition → premium
  legend: 'reputation', elite: 'reputation', vip: 'reputation',
  // Trust & Intelligence — verification, governance, data, coordination
  zone: 'trust', system: 'trust', analytics: 'trust', alert: 'trust', nexus: 'trust',
};
const CATEGORY_ORDER: [string, string][] = [
  ['money',      'Money & Commerce'],
  ['work',       'Business & Work'],
  ['realworld',  'Real World'],
  ['social',     'Identity & Social'],
  ['reputation', 'Reputation'],
  ['trust',      'Trust & Intelligence'],
];

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

export function HubAppsGrid({ apps }: Props) {
  const router = useRouter();
  const [query,   setQuery]   = useState('');
  const [favs,    setFavs]    = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => { setFavs(readList(FAV_KEY)); setRecents(readList(RECENT_KEY)); }, []);

  const bySlug = useMemo(() => new Map(apps.map((a) => [a.slug, a])), [apps]);

  const openApp = useCallback((app: HubApp) => {
    haptic('light');
    // Track recents (most-recent first, unique, capped).
    setRecents((prev) => {
      const next = [app.slug, ...prev.filter((s) => s !== app.slug)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (app.href.startsWith('/api/') || app.href.startsWith('http')) window.location.href = app.href;
    else router.push(app.href);
  }, [router]);

  const toggleFav = useCallback((slug: string) => {
    haptic('light');
    setFavs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  if (!apps.length) return null;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = (a: HubApp) => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q);

  const favApps    = favs.map((s) => bySlug.get(s)).filter((a): a is HubApp => !!a);
  const recentApps = recents.map((s) => bySlug.get(s)).filter((a): a is HubApp => !!a).filter((a) => !favs.includes(a.slug));

  // Category sections in a stable order (only categories that have apps). Any app not
  // in the map falls into a "More" bucket so nothing is ever dropped.
  const grouped = CATEGORY_ORDER
    .map(([key, label]) => ({ group: key, label, items: apps.filter((a) => CATEGORY_OF[a.slug] === key) }))
    .filter((s) => s.items.length > 0);
  const others = apps.filter((a) => !CATEGORY_OF[a.slug]);
  if (others.length) grouped.push({ group: 'other', label: 'More', items: others });

  // Compact icon tile (WeChat/iOS-style launcher) — dense so all apps fit in a few
  // rows. Tap opens; the corner star pins/unpins without opening.
  const AppCard = ({ app }: { app: HubApp }) => {
    const isFav = favs.includes(app.slug);
    return (
      <div style={{ position: 'relative' }}>
        <button className="tec-btn" onClick={() => openApp(app)}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
            padding: '10px 2px', background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17,
            background: `linear-gradient(135deg, ${appAccentRgba(app.slug, 0.20)}, ${appAccentRgba(app.slug, 0.06)})`,
            border: `1px solid ${appAccentRgba(app.slug, 0.30)}`,
            boxShadow: `0 4px 14px ${appAccentRgba(app.slug, 0.12)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>{app.emoji}</div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)', textAlign: 'center',
            lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{app.name}</span>
        </button>
        {/* Favorite toggle */}
        <button onClick={(e) => { e.stopPropagation(); toggleFav(app.slug); }}
          aria-label={isFav ? `Unpin ${app.name}` : `Pin ${app.name}`} aria-pressed={isFav}
          style={{
            position: 'absolute', top: 2, insetInlineEnd: 2, width: 20, height: 20, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: 'transparent', border: 'none', fontSize: 11, lineHeight: 1,
            color: isFav ? '#FBBF24' : 'rgba(255,255,255,0.22)',
          }}>{isFav ? '★' : '☆'}</button>
      </div>
    );
  };

  const Section = ({ title, items, accent }: { title: string; items: HubApp[]; accent?: string }) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent ?? 'rgba(255,255,255,0.4)', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {items.map((app) => <AppCard key={app.slug} app={app} />)}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 16px 0', animation: 'tec-fade-in 0.6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tec-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>Apps</span>
        </div>
        <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: 999, letterSpacing: 1 }}>
          {apps.length} LIVE
        </span>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <span style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps"
          aria-label="Search apps"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 40px',
            borderRadius: 14, background: '#111627', border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 13, outline: 'none',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear search"
            style={{ position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>✕</button>
        )}
      </div>

      {searching ? (() => {
        const results = apps.filter(matches);
        return results.length
          ? <Section title={`${results.length} result${results.length === 1 ? '' : 's'}`} items={results} />
          : <div style={{ padding: '28px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No apps match “{query}”.</div>;
      })() : (
        <>
          {favApps.length    > 0 && <Section title="★ Favorites" items={favApps}    accent="#FBBF24" />}
          {recentApps.length > 0 && <Section title="Recent"      items={recentApps} />}
          {grouped.map((s) => <Section key={s.group} title={s.label} items={s.items} />)}
        </>
      )}
    </div>
  );
}
