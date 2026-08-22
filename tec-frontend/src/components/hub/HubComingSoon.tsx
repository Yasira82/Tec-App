'use client';

import { useTranslation } from '@/lib/i18n';
import { ALL_DOMAINS, COMING_SOON } from '@/domains/_registry';

const GROUPS = [
  { group: 'finance',      label: '💰 Finance',    color: '#FBBF24' },
  { group: 'commerce',     label: '🛒 Commerce',   color: '#7eb8f7' },
  { group: 'real_world',   label: '🏙️ Real World', color: '#22C55E' },
  { group: 'social',       label: '🌍 Social',     color: '#8b5cf6' },
  { group: 'tech',         label: '⚡ Tech',       color: '#f59e0b' },
  { group: 'monetization', label: '🏆 Membership', color: '#FBBF24' },
] as const;

export function HubComingSoon() {
  const { t } = useTranslation();
  // Every one of the 24 apps is `live`, so this list is empty — and an empty list
  // used to render as a bare "COMING SOON · 24 APPS" heading with nothing under it,
  // sitting at the bottom of the Hub. A section with no content is not a section.
  if (!COMING_SOON.length) return null;

  return (
    <div style={{ padding: '24px 16px 0', animation: 'tec-fade-in 0.65s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase' }}>{t.hub.comingSoon.title}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
          {t.hub.comingSoon.count.replace('{n}', String(COMING_SOON.length)).replace('{total}', String(ALL_DOMAINS.length))}
        </span>
      </div>

      {GROUPS.map(({ group, label, color }) => {
        const apps = COMING_SOON.filter(d => d.group === group);
        if (!apps.length) return null;
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: `${color}60`, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
              {apps.map(app => (
                <div key={app.slug} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 6px', background: 'rgba(255,255,255,0.02)',
                  borderRadius: 14, opacity: 0.5, border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontSize: 20 }}>{app.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{app.name.en}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
