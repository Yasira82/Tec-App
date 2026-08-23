'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter }     from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { t as tr } from '@/domains/_types';
import type { Locale } from '@/domains/_types';
import { haptic }        from '@/lib/hub/utils';
import { HubApp }        from '@/lib/hub/types';
// The user-facing taxonomy is SHARED (see src/domains/_categories.ts). It used to
// live here behind a comment saying not to use the registry's `group`; the landing
// page then used `group` anyway and the two surfaces disagreed on 17 of 23 apps.
import { CATEGORIES, CATEGORY_OF, iconOf } from '@/domains/_categories';
import { Icon } from '@/components/ui/Icon';

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

const FAV_KEY = 'tec_fav_apps';

/**
 * The launcher is on FIXED rails: four columns, every section, always.
 *
 * This replaces a rule that chose the column count per section to avoid a lone
 * trailing tile (5 -> 3+2). It did avoid it, and it cost something worse: a
 * section of five sat on 3 rails while the section above it sat on 4, so the
 * SAME app appeared at two different x-positions on one screen and the grid
 * read as though it had been pasted together from pieces.
 *
 * The two goals genuinely conflict — you cannot keep one set of vertical rails
 * and also re-balance each section — and alignment is the one that carries. It
 * is what every phone launcher does, and a ragged last row is a shape people
 * already read as "that is all of them", where a shifting rail is read as a bug.
 */
export const GRID_COLUMNS = 4;

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

export function HubAppsGrid({ apps, openTo }: Props) {
  const { t, dir } = useTranslation();
  const locale: Locale = dir === 'rtl' ? 'ar' : 'en';
  const router = useRouter();
  const [query,   setQuery]   = useState('');
  const [favs,    setFavs]    = useState<string[]>([]);
  const [editing, setEditing] = useState(false); // Edit mode → pin/unpin surface

  useEffect(() => { setFavs(readList(FAV_KEY)); }, []);

  const bySlug = useMemo(() => new Map(apps.map((a) => [a.slug, a])), [apps]);

  const openApp = useCallback((app: HubApp) => {
    haptic('light');
    // Single-launch-authority: on surfaces that pass `openTo` (e.g. the Dashboard),
    // a tap goes to the Hub to launch — never opens the app directly (P1/P2).
    if (openTo) {
      if (openTo.startsWith('/api/') || openTo.startsWith('http')) window.location.href = openTo;
      else router.push(openTo);
      return;
    }
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

  const favApps = favs.map((s) => bySlug.get(s)).filter((a): a is HubApp => !!a);

  // Category sections in a stable order (only categories that have apps). Any app not
  // in the map falls into a "More" bucket so nothing is ever dropped.
  const grouped = CATEGORIES
    .map(({ key, label }) => ({ group: key as string, label: tr(label, locale), items: apps.filter((a) => CATEGORY_OF[a.slug] === key) }))
    .filter((s) => s.items.length > 0);
  const others = apps.filter((a) => !CATEGORY_OF[a.slug]);
  if (others.length) grouped.push({ group: 'other', label: t.hub.apps.other, items: others });

  // Compact icon tile (WeChat/iOS-style launcher) — dense so all apps fit in a few
  // rows. Tap opens (or toggles the pin while in Edit mode). The pin control only
  // appears in Edit mode, so the default grid stays clean (no star on every tile).
  const AppCard = ({ app, featured = false }: { app: HubApp; featured?: boolean }) => {
    const isFav = favs.includes(app.slug);
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
            width: 54, height: 54, borderRadius: 16,
            // Neutral. The tile used to be tinted with the category accent and lit
            // by a coloured glow — six saturated hues on one screen, each repeated
            // across four or five tiles. Colour that appears everywhere stops being
            // information. The group CARD does the grouping now; a featured app is
            // the only tile that gets the accent, and it stands out because of it.
            background: featured ? 'var(--tec-accent-tile)' : 'var(--tec-surface-2)',
            border: featured ? '1px solid var(--tec-border-gold)' : '1px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: editing && !isFav ? 0.55 : 1,
          }}>
            <Icon name={iconOf(app.slug)} size={26}
              color={featured ? 'var(--tec-gold)' : 'var(--tec-icon)'} strokeWidth={1.8} />
            {/* Edit-mode pin badge — only rendered while editing */}
            {editing && (
              <span aria-hidden style={{
                position: 'absolute', top: -6, insetInlineEnd: -6, width: 20, height: 20, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1,
                background: isFav ? 'var(--tec-gold)' : 'var(--tec-surface-3)', color: isFav ? 'var(--tec-on-gold)' : 'var(--tec-text-2)',
                border: '1px solid var(--tec-border)', fontWeight: 800,
              }}><Icon name={isFav ? 'star' : 'plus'} size={11}
                  color={isFav ? 'var(--tec-on-gold)' : 'var(--tec-text-2)'} strokeWidth={2.4} /></span>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--tec-text-1)', textAlign: 'center',
            lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{app.name}</span>
        </button>
      </div>
    );
  };

  /**
   * A section is a CARD, not a coloured heading.
   *
   * Grouping used to be carried by the accent — every tile in a section tinted
   * the same hue. A boundary does that job without spending a colour, and it
   * frees the accent for the one row that is actually promoted.
   */
  const Section = ({ title, items, featured = false }: {
    title: string; items: HubApp[]; featured?: boolean;
  }) => (
    // Every group is the same card, Favourites included. Favourites used to be
    // transparent and borderless, so on a page where each group is a bounded
    // card it read as a stray tile someone had left on the background. What
    // makes it featured is the tile treatment inside, not the absence of a box.
    <div style={{
      marginTop: 12,
      background: 'var(--tec-surface-1)',
      border: '1px solid var(--tec-border)',
      borderRadius: 20,
      padding: '14px 8px 4px',
    }}>
      <div style={{
        fontSize: 15, fontWeight: 800,
        color: 'var(--tec-text-1)', margin: '0 8px 10px',
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLUMNS},1fr)`, gap: 4 }}>
        {items.map((app) => <AppCard key={app.slug} app={app} featured={featured} />)}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 16px 0', animation: 'tec-fade-in 0.6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tec-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tec-green)', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tec-text-2)', letterSpacing: 2, textTransform: 'uppercase' }}>{t.hub.apps.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { haptic('light'); setEditing((e) => !e); }}
            aria-pressed={editing}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
              padding: '3px 10px', borderRadius: 999,
              background: editing ? 'var(--tec-gold-dim)' : 'var(--tec-fill-soft)',
              border: `1px solid ${editing ? 'var(--tec-border-gold)' : 'var(--tec-border)'}`,
              color: editing ? 'var(--tec-gold)' : 'var(--tec-text-2)',
            }}>{editing ? t.hub.apps.done : t.hub.apps.edit}</button>
          <span style={{ fontSize: 10, color: 'var(--tec-green)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: 999, letterSpacing: 1 }}>
            {apps.length} {t.hub.apps.live}
          </span>
        </div>
      </div>

      {/* Edit-mode hint */}
      {editing && (
        <div style={{ fontSize: 11, color: 'rgba(248,184,32,0.7)', marginBottom: 8 }}>
          {t.hub.apps.editHint}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <span style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}><Icon name="search" size={14} color="var(--tec-text-3)" strokeWidth={2} /></span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.hub.apps.search}
          aria-label={t.hub.apps.search}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 40px',
            borderRadius: 14, background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
            color: 'var(--tec-text-1)', fontSize: 13, outline: 'none',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label={t.hub.apps.clearSearch}
            style={{ position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 999, border: 'none', background: 'var(--tec-fill-soft)', color: 'var(--tec-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={13} color="var(--tec-text-2)" strokeWidth={2} /></button>
        )}
      </div>

      {searching ? (() => {
        const results = apps.filter(matches);
        return results.length
          ? <Section
              title={results.length === 1 ? t.hub.apps.resultOne : t.hub.apps.results.replace('{n}', String(results.length))}
              items={results} />
          : <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--tec-text-3)', fontSize: 13 }}>
              {t.hub.apps.noMatch.replace('{q}', query)}
            </div>;
      })() : (
        <>
          {favApps.length > 0 && <Section title={t.hub.apps.favorites} items={favApps} featured />}
          {grouped.map((s) => <Section key={s.group} title={s.label} items={s.items} />)}
        </>
      )}
    </div>
  );
}
