'use client';

/**
 * Guest / Demo mode (A1) — a read-only, no-login preview of what's inside TEC.
 *
 * Why: the documented top-of-funnel bottleneck is that a skeptic won't connect a
 * Pi account to an unknown app. This lets them SEE the ecosystem populated first
 * (like Reputa's "Demo_Pioneer"), then decide. Everything here is clearly-labelled
 * SAMPLE data — no auth, no real balances, no Pi calls. Pure client-side preview.
 *
 * The apps grid reuses the SAME source (`@/lib/apps`) and the SAME card styles
 * (`../page.module.css`) as the landing, so the two never drift. Per product
 * decision, a tap here goes to Sign in — apps open only from the authenticated Hub.
 */

import type { CSSProperties } from 'react';
import Link                from 'next/link';
import { useTranslation }  from '@/lib/i18n';
import LanguageSwitcher    from '@/components/LanguageSwitcher';
import { APPS }            from '@/lib/apps';
import { AppCard }         from '@/components/ecosystem/AppCard';
import type { Locale }     from '@/domains/_types';
import styles              from '../page.module.css';

const GOLD = 'var(--tec-gold)';
const BG   = '#050816';
const CARD = '#0B1020';
const LINE = 'rgba(var(--tec-gold-rgb),0.14)';
const MUTE = 'rgba(232,224,208,0.45)';

export default function DemoPage() {
  const { t, dir } = useTranslation();
  const locale: Locale = dir === 'rtl' ? 'ar' : 'en';
  const d = t.home.demo;

  // Pre-login: every app tile takes the visitor to Sign in (apps open from the Hub).
  const toSignIn = () => { window.location.href = '/#payment'; };

  return (
    <main dir={dir} style={{ minHeight: '100vh', background: BG, color: '#e8e0d0',
      fontFamily: 'system-ui, sans-serif', padding: '18px 16px 60px', maxWidth: 640, margin: '0 auto' }}>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Link href="/" style={{ color: MUTE, textDecoration: 'none', fontSize: 13 }}>
          {dir === 'rtl' ? '→ ' : '← '}{d.back}
        </Link>
        <LanguageSwitcher />
      </div>

      {/* guest badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
        border: '1px solid rgba(126,231,192,0.3)', background: 'rgba(126,231,192,0.07)',
        borderRadius: 100, fontSize: 12, fontWeight: 600, color: '#7ee7c0', marginBottom: 16 }}>
        🛡️ {d.badge}
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.2 }}>{d.title}</h1>
      <p style={{ fontSize: 14, color: MUTE, margin: '0 0 24px', lineHeight: 1.6 }}>{d.subtitle}</p>

      {/* sample identity card */}
      <div style={{ position: 'relative', background: CARD, border: `1px solid ${LINE}`, borderRadius: 18,
        padding: 20, marginBottom: 16, overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: 12, [dir === 'rtl' ? 'left' : 'right']: 12,
          fontSize: 9, letterSpacing: '0.14em', fontWeight: 700, color: GOLD,
          border: `1px solid ${LINE}`, borderRadius: 6, padding: '3px 7px' }}>{d.sampleTag}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--tec-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👑</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{d.identityName}</div>
            <div style={{ fontSize: 13, color: GOLD }}>{d.identityHandle}</div>
            <div style={{ fontSize: 11, color: '#7ee7c0', marginTop: 3 }}>● {t.home.trust.official}</div>
          </div>
        </div>
      </div>

      {/* ecosystem passport */}
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTE, marginBottom: 14 }}>{d.passport}</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[[ String(APPS.length), d.appsLabel ], [ '1', d.identityLabel ], [ '1', d.walletLabel ]].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: 30, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 10, color: MUTE, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* apps grid — the SAME shared <AppCard> the landing renders, so the two
          cannot drift again (they had already: same styles, duplicated JSX). */}
      <div className={styles.appsGrid} style={{ marginBottom: 28 }}>
        {APPS.map((app, i) => (
          <AppCard key={app.slug} app={app} locale={locale} index={i} onOpen={toSignIn} />
        ))}
      </div>

      {/* what you can do */}
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>{d.doTitle}</h2>
      {[[ '🛒', d.do1Title, d.do1Desc ], [ '💎', d.do2Title, d.do2Desc ], [ '🔑', d.do3Title, d.do3Desc ]].map(([e, ti, de]) => (
        <div key={ti} style={{ display: 'flex', gap: 12, background: CARD, border: `1px solid ${LINE}`,
          borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 22 }}>{e}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{ti}</div>
            <div style={{ fontSize: 12, color: MUTE, marginTop: 2, lineHeight: 1.5 }}>{de}</div>
          </div>
        </div>
      ))}

      {/* CTA */}
      <Link href="/#payment" style={{ display: 'block', textAlign: 'center', marginTop: 22,
        background: 'var(--tec-gold)', color: '#050816',
        fontWeight: 700, fontSize: 15, padding: '16px', borderRadius: 14, textDecoration: 'none' }}>
        {d.signIn}
      </Link>

      {/* trust footer */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {[t.home.trust.free, t.home.trust.noPassphrase, t.home.trust.readOnly].map((b) => (
          <span key={b} style={{ fontSize: 11, color: '#7ee7c0', border: '1px solid rgba(126,231,192,0.18)',
            background: 'rgba(126,231,192,0.05)', borderRadius: 100, padding: '5px 11px' }}>{b}</span>
        ))}
      </div>
    </main>
  );
}
