'use client';

import { useState, useMemo, useEffect } from 'react';
import Link                      from 'next/link';
import { useTranslation }        from '@/lib/i18n';
import LanguageSwitcher          from '@/components/LanguageSwitcher';
import PiPaymentButton           from '@/components/payment/PiPaymentButton';
import InstallPrompt             from '@/components/InstallPrompt';
import { AppCard }               from '@/components/ecosystem/AppCard';
import { APPS, GROUPS, type EcosystemApp } from '@/lib/apps';
import { getDomain, ALL_DOMAINS } from '@/domains/_registry';
import { t as tr }               from '@/domains/_types';
import type { Locale } from '@/domains/_types';
import type { AppCategory } from '@/domains/_categories';
import { iconOf }            from '@/domains/_categories';
import { Icon }              from '@/components/ui/Icon';
import styles                    from './page.module.css';

/**
 * The ecosystem's public size — 24 — counted from the registry rather than typed
 * into copy, so it can never fall out of step with the platform again. It counts
 * every domain INCLUDING the OS layer (TEC itself): the grid lists the 23 apps a
 * visitor can open, because the 24th is the Hub they are standing in.
 */
const ECOSYSTEM_SIZE = ALL_DOMAINS.length;
const withCount = (s: string) => s.replace('{count}', String(ECOSYSTEM_SIZE));

export default function HomePage() {
  // Fire-and-forget backend warmup (Railway cold starts — see /api/warmup).
  useEffect(() => { fetch('/api/warmup').catch(() => {}); }, []);

  const { t, dir }                        = useTranslation();
  const locale: Locale                    = dir === 'rtl' ? 'ar' : 'en';
  const [activeGroup, setActiveGroup]     = useState<AppCategory | 'other' | 'all'>('all');
  const [searchQuery, setSearchQuery]     = useState('');

  const filteredApps = useMemo(() => {
    let result = APPS;
    if (activeGroup !== 'all') {
      result = result.filter(a => (a.category ?? 'other') === activeGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Search BOTH languages regardless of UI locale — a visitor reading the
      // Arabic page still types "commerce".
      result = result.filter(a =>
        a.slug.includes(q) ||
        a.name.en.toLowerCase().includes(q) ||
        (a.name.ar ?? '').includes(q) ||
        a.host.includes(q) ||
        a.blurb.en.toLowerCase().includes(q) ||
        (a.blurb.ar ?? '').includes(q)
      );
    }
    return result;
  }, [activeGroup, searchQuery]);

  const nexus = getDomain('nexus');

  // Pre-login page: apps open only from the authenticated Hub (after Sign in with Pi),
  // so every "open" on this page lands on the Sign in section, never a dead link.
  const goToSignIn = () => {
    const el = typeof document !== 'undefined' ? document.getElementById('payment') : null;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth' });
    window.location.hash = 'payment';
  };
  const openApp = (_app: EcosystemApp) => goToSignIn();

  return (
    <main className={styles.main} dir={dir}>
      {/* Background */}
      <div className={styles.bg} aria-hidden>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />
        <div className={styles.bgOrb3} />
        <div className={styles.bgGrid} />
        <div className={styles.bgNoise} />
      </div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo} dir="ltr">
          <span className={styles.navLogoMark}>T</span>
          <span className={styles.navLogoText}>EC</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#ecosystem" className={styles.navLink}>{t.home.ecosystem}</a>
          <a href="#payment"   className={styles.navLink}>{t.common.login}</a>
          <Link href="/ai" className={styles.navAiLink}>
            🤖 {dir === 'rtl' ? 'المساعد' : 'Assistant'}
          </Link>
        </div>
        <div className={styles.navRight}>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          {t.common.piEcosystem}
        </div>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroTitleMain}>{t.common.appName}</span>
          <span className={styles.heroTitleAccent}>{t.common.tagline}</span>
        </h1>
        <p className={styles.heroSub}>
          {withCount(t.home.description)}
          <br />
          {t.home.subDescription}
        </p>
        {/* Every number here is TEC's own, and the app count is derived rather than
            typed. The middle slot used to read "47M+ / PI USERS" — that is Pi
            Network's population, and sitting in TEC's stat row it reads as TEC's
            userbase. The tagline's own promise (one identity, one wallet) is both
            true and ours. */}
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{ECOSYSTEM_SIZE}</span>
            <span className={styles.heroStatLabel}>{t.home.stats.apps}</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>1</span>
            <span className={styles.heroStatLabel}>{t.home.stats.identity}</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>1</span>
            <span className={styles.heroStatLabel}>{locale === 'ar' ? 'محفظة' : 'Wallet'}</span>
          </div>
        </div>

        {/* Trust strip (A4) — answers "is this a scam?" before it's asked */}
        <div className={styles.trustStrip}>
          <span className={styles.trustBadge}>🆓 {t.home.trust.free}</span>
          <span className={styles.trustBadge}>🔐 {t.home.trust.noPassphrase}</span>
          <span className={styles.trustBadge}>💳 {t.home.trust.noPurchase}</span>
          <span className={styles.trustBadge}>🛡️ {t.home.trust.readOnly}</span>
          <span className={styles.trustBadge}>✅ {t.home.trust.official}</span>
        </div>

        {/* Guest/Demo entry (A1) — see the ecosystem before connecting */}
        <Link href="/demo" className={styles.guestLink}>
          🔍 {t.home.demo.cta}
        </Link>
      </section>

      {/* Install to home screen (A3) — retention: one-tap return */}
      <InstallPrompt />

      {/* Sign in */}
      <section id="payment" className={styles.paymentSection}>
        <div className={styles.paymentCard}>
          <div className={styles.paymentCardInner}>
            <PiPaymentButton />
            <p style={{ fontSize: 11, color: '#4a4a5a', marginTop: 12, textAlign: 'center' }}>
              🌐 Best experience in Pi Browser
            </p>
          </div>
        </div>
      </section>

      {/* Featured Nexus — icon, copy and destination all from the registry.
          The button used to open `https://nexus.pi`: a domain that does not
          resolve yet, so the one call-to-action above the fold was a dead link. */}
      <section className={styles.featuredSection}>
        <div className={styles.featuredCard}>
          <span className={styles.featuredEmoji}>
            <Icon name={iconOf('nexus')} size={48} color="var(--tec-gold)" strokeWidth={1.6} />
          </span>
          <h2 className={styles.featuredTitle}>TEC Nexus</h2>
          <p className={styles.featuredDesc}>
            {nexus ? tr(nexus.valueProp ?? nexus.description, locale) : t.apps.Nexus}
          </p>
          <button className={styles.featuredBtn} onClick={goToSignIn}>
            {dir === 'rtl' ? 'استكشف Nexus ←' : 'Explore Nexus →'}
          </button>
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosystem" className={styles.ecosystemSection}>
        <div className={styles.ecosystemHeader}>
          <p className={styles.sectionEyebrow}>{t.home.ecosystem}</p>
          <h2 className={styles.sectionTitle}>
            {withCount(t.home.ecosystemTitle).split('—')[0]}—{' '}
            <span className={styles.goldText}>{withCount(t.home.ecosystemTitle).split('—')[1]}</span>
          </h2>
          <p className={styles.sectionDesc}>{withCount(t.home.description)}</p>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={dir === 'rtl' ? 'ابحث عن تطبيق...' : 'Search apps...'}
            aria-label="Search apps"
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Group filter — the registry's own groups, each with its real count.
            The old list was 10 hand-typed categories that no longer matched the
            registry, so "Health" filtered to one app that is a developer tool. */}
        <div className={styles.filterBar} role="group" aria-label={locale === 'ar' ? 'تصفية التطبيقات' : 'Filter apps'}>
          <button
            onClick={() => setActiveGroup('all')}
            className={`${styles.filterBtn} ${activeGroup === 'all' ? styles.filterBtnActive : ''}`}
          >
            {locale === 'ar' ? 'الكل' : 'All'} <span className={styles.filterCount}>{APPS.length}</span>
          </button>
          {GROUPS.map(g => (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              className={`${styles.filterBtn} ${activeGroup === g.key ? styles.filterBtnActive : ''}`}
            >
              {tr(g.label, locale)} <span className={styles.filterCount}>{g.count}</span>
            </button>
          ))}
        </div>

        {/* Apps Grid */}
        {filteredApps.length === 0 ? (
          <div className={styles.noResults}>
            <span>🔍</span>
            <p>{dir === 'rtl' ? 'لا توجد نتائج' : 'No apps found'}</p>
            <button
              className={styles.noResultsBtn}
              onClick={() => { setSearchQuery(''); setActiveGroup('all'); }}
            >
              {dir === 'rtl' ? 'مسح البحث' : 'Clear search'}
            </button>
          </div>
        ) : (
          <div className={styles.appsGrid}>
            {filteredApps.map((app, i) => (
              <AppCard key={app.slug} app={app} locale={locale} index={i} onOpen={openApp} />
            ))}
          </div>
        )}

        <p className={styles.appCount}>{filteredApps.length} {t.home.stats.apps}</p>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo} dir="ltr">
          <span className={styles.navLogoMark}>T</span>
          <span className={styles.navLogoText}>EC</span>
        </div>
        <p className={styles.footerText}>
          © 2026 {t.common.tagline} · Built on Pi Network
        </p>
        <div className={styles.footerLinks}>
          <a href="/privacy" className={styles.footerLink}>Privacy</a>
          <a href="/terms"   className={styles.footerLink}>Terms</a>
        </div>
      </footer>

      {/* Floating AI Button */}
      <Link href="/ai" className={styles.floatingAi} aria-label="TEC Assistant">
        <span className={styles.floatingAiIcon}>🤖</span>
        <span className={styles.floatingAiPulse} />
      </Link>
    </main>
  );
            }
