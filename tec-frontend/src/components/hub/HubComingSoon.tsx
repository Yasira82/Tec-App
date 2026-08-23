'use client';

import { useTranslation, fill } from '@/lib/i18n';
import { ALL_DOMAINS, COMING_SOON } from '@/domains/_registry';
import { t as tr, type Locale }      from '@/domains/_types';
import { iconOf }                    from '@/domains/_categories';
import { Icon }                      from '@/components/ui/Icon';

// Emoji + colour are presentation; the WORD comes from the dictionary. This list
// renders only when an app is not yet live — which is nobody today — so an English
// label here would sit unnoticed until the day it suddenly appears on an Arabic
// screen. Cheaper to translate now than to rediscover later.
// `label` is the muted heading colour, written out at its final opacity. It used
// to be a solid hex with `60` appended at the call site — a trick that stops
// working the moment the value becomes a design token (`var(--x)60` is not a colour).
const GROUPS = [
  { group: 'finance',      emoji: '💰', label: 'rgba(251,191,36,0.38)' },
  { group: 'commerce',     emoji: '🛒', label: 'rgba(126,184,247,0.38)' },
  { group: 'real_world',   emoji: '🏙️', label: 'rgba(34,197,94,0.38)'  },
  { group: 'social',       emoji: '🌍', label: 'rgba(139,92,246,0.38)' },
  { group: 'tech',         emoji: '⚡', label: 'rgba(245,158,11,0.38)' },
  { group: 'monetization', emoji: '🏆', label: 'rgba(251,191,36,0.38)' },
] as const;

export function HubComingSoon() {
  const { t, dir } = useTranslation();
  const locale: Locale = dir === 'rtl' ? 'ar' : 'en';
  // Every one of the 24 apps is `live`, so this list is empty — and an empty list
  // used to render as a bare "COMING SOON · 24 APPS" heading with nothing under it,
  // sitting at the bottom of the Hub. A section with no content is not a section.
  if (!COMING_SOON.length) return null;

  return (
    <div style={{ padding: '24px 16px 0', animation: 'tec-fade-in 0.65s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tec-text-4)', letterSpacing: 2, textTransform: 'uppercase' }}>{t.hub.comingSoon.title}</span>
        <span style={{ fontSize: 10, color: 'var(--tec-text-4)', letterSpacing: 1 }}>
          {fill(t.hub.comingSoon.count, { n: COMING_SOON.length, total: ALL_DOMAINS.length })}
        </span>
      </div>

      {GROUPS.map(({ group, emoji, label }) => {
        const apps = COMING_SOON.filter(d => d.group === group);
        if (!apps.length) return null;
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: label, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{emoji} {t.hub.comingSoon.groups[group]}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
              {apps.map(app => (
                <div key={app.slug} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 6px', background: 'var(--tec-fill-softer)',
                  borderRadius: 14, opacity: 0.5, border: '1px solid var(--tec-border)',
                }}>
                  <Icon name={iconOf(app.slug)} size={20} color="var(--tec-text-2)" strokeWidth={1.8} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--tec-text-3)', textAlign: 'center' }}>{tr(app.name, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
