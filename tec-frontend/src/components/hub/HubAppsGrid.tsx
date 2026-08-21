'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter }     from 'next/navigation';
import { haptic }        from '@/lib/hub/utils';
import { HubApp }        from '@/lib/hub/types';

interface Props {
  apps: HubApp[];
  /**
   * Single-launch-authority override. When set (e.g. the Dashboard passes "/hub"),
   * tapping any app navigates HERE instead of opening the app directly — so the Hub
   * stays the ONE place apps launch from (C-47: Hub = Conductor / ecosystem routing;
   * P1 Single Source of Truth). Unset on the Hub itself → tiles open the app.
   */
  openTo?: string;
}

const FAV_KEY    = 'tec_fav_apps';
const RECENT_KEY = 'tec_recent_apps';
const RECENT_MAX = 4;

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
// One harmonized accent per category (EVL palette, C-83) so each section reads as a
// coherent colour family instead of 23 unrelated tile colours (rainbow clutter).
const CATEGORY_ORDER: [string, string, string][] = [
  ['money',      'Money & Commerce',      '#FBBF24'], // WEALTH gold
  ['work',       'Business & Work',       '#3B82F6'], // GOVERNANCE blue
  ['realworld',  'Real World',            '#22C55E'], // GROWTH green
  ['social',     'Identity & Social',     '#8B5CF6'], // IDENTITY purple
  ['reputation', 'Reputation',            '#EC4899'], // recognition pink
  ['trust',      'Trust & Intelligence',  '#06B6D4'], // INTELLIGENCE cyan
];
const CATEGORY_ACCENT: Record<string, string> =
  Object.fromEntries(CATEGORY_ORDER.map(([key, , accent]) => [key, accent]));
const OTHER_ACCENT = '#94A3B8';
const accentOf = (slug: string) => CATEGORY_ACCENT[CATEGORY_OF[slug]] ?? OTHER_ACCENT;

// Convert a #RRGGBB hex + alpha → rgba() string (tiles use a category accent, not
// the per-app accent, so the colour is derived here rather than via appAccentRgba).
function hexRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

export function HubAppsGrid({ apps, openTo }: Props) {
  const router = useRouter();
  const [query,   setQuery]   = useState('');
  const [favs,    setFavs]    = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [editing, setEditing] = useState(false); // Edit mode → pin/unpin surface

  useEffect(() => { setFavs(readList(FAV_KEY)); setRecents(readList(RECENT_KEY)); }, []);

  const bySlug = useMemo(() => new Map(apps.map((a) => [a.slug, a])), [apps]);

  const openApp = useCallback((app: HubApp) => {
    haptic('light');
    // Single-launch-authority: on surfaces that pass `openTo` (e.g. the Dashboard),
    // a tap goes to the Hub to launch — never opens the app directly (P1/P2). No
    // recents tracking here: the launch (and its recents) happens on the Hub.
    if (openTo) {
      if (openTo.startsWith('/api/') || openTo.startsWith('http')) window.location.href = openTo;
      else router.push(openTo);
      return;
    }
    // Track recents (most-recent first, unique, capped).
    setRecents((prev) => {
      const next = [app.slug, ...prev.filter((s) => s !== app.slug)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (app.href.startsWith('/api/') || app.href.startsWith('http')) window.location.href = app.href;
    else router.push(app.href);
  }, [router, openTo]);

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
  // Recent excludes favourites AND anything shown in a category section would still
  // dup — but Recent stays a single capped row (max 4) so the small overlap reads as
  // "jump back in", not clutter. Favourites are always removed to avoid a hard dup.
  const recentApps = recents
    .map((s) => bySlug.get(s))
    .filter((a): a is HubApp => !!a)
    .filter((a) => !favs.includes(a.slug))
    .slice(0, RECENT_MAX);

  // Category sections in a stable order (only categories that have apps). Any app not
  // in the map falls into a "More" bucket so nothing is ever dropped.
  const grouped = CATEGORY_ORDER
    .map(([key, label]) => ({ group: key, label, items: apps.filter((a) => CATEGORY_OF[a.slug] === key) }))
    .filter((s) => s.items.length > 0);
  const others = apps.filter((a) => !CATEGORY_OF[a.slug]);
  if (others.length) grouped.push({ group: 'other', label: 'More', items: others });

  // Compact icon tile (WeChat/iOS-style launcher) — dense so all apps fit in a few
  // rows. Tap opens (or toggles the pin while in Edit mode). The pin control only
  // appears in Edit mode, so the default grid stays clean (no star on every tile).
  const AppCard = ({ app }: { app: HubApp }) => {
    const isFav  = favs.includes(app.slug);
    const accent = accentOf(app.slug);
    return (
      <div style={{ position: 'relative' }}>
        <button className="tec-btn"
          onClick={() => (editing ? toggleFav(app.slug) : openApp(app))}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
            padding: '10px 2px', background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
          <div style={{
            position: 'relative',
            width: 54, height: 54, borderRadius: 17,
            background: `linear-gradient(135deg, ${hexRgba(accent, 0.18)}, ${hexRgba(accent, 0.05)})`,
            border: `1px solid ${hexRgba(accent, 0.28)}`,
            boxShadow: `0 4px 14px ${hexRgba(accent, 0.10)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            opacity: editing && !isFav ? 0.55 : 1,
          }}>
            {app.emoji}
            {/* Edit-mode pin badge — only rendered while editing */}
            {editing && (
              <span aria-hidden style={{
                position: 'absolute', top: -6, insetInlineEnd: -6, width: 20, height: 20, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1,
                background: isFav ? '#FBBF24' : '#1b2233', color: isFav ? '#050816' : 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.15)', fontWeight: 800,
              }}>{isFav ? '★' : '+'}</span>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)', textAlign: 'center',
            lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{app.name}</span>
        </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { haptic('light'); setEditing((e) => !e); }}
            aria-pressed={editing}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
              padding: '3px 10px', borderRadius: 999,
              background: editing ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${editing ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: editing ? '#FBBF24' : 'rgba(255,255,255,0.55)',
            }}>{editing ? 'Done' : 'Edit'}</button>
          <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: 999, letterSpacing: 1 }}>
            {apps.length} LIVE
          </span>
        </div>
      </div>

      {/* Edit-mode hint */}
      {editing && (
        <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.7)', marginBottom: 8 }}>
          Tap an app to pin it to ★ Favorites.
        </div>
      )}

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
          {recentApps.length > 0 && !editing && <Section title="Recent" items={recentApps} />}
          {grouped.map((s) => <Section key={s.group} title={s.label} items={s.items} accent={hexRgba(CATEGORY_ACCENT[s.group] ?? OTHER_ACCENT, 0.75)} />)}
        </>
      )}
    </div>
  );
}
