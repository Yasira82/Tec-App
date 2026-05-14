'use client';

import { LIVE_DOMAINS, COMING_SOON, getVisibleDomains } from '@/domains/_registry';
import { useState, useMemo }     from 'react';
import Link                      from 'next/link';
import { useTranslation }        from '@/lib/i18n';
import LanguageSwitcher          from '@/components/LanguageSwitcher';
import PiPaymentButton           from '@/components/payment/PiPaymentButton';
import styles                    from './page.module.css';

const APPS = [
  { name: 'Life',        emoji: '🌱', domain: 'life.pi',        category: 'Personal'      },
  { name: 'Insure',      emoji: '🛡️', domain: 'insure.pi',      category: 'Finance'       },
  { name: 'Commerce',    emoji: '🛒', domain: 'commerce.pi',    category: 'Business'      },
  { name: 'Ecommerce',   emoji: '📦', domain: 'ecommerce.pi',   category: 'Business'      },
  { name: 'Assets',      emoji: '💼', domain: 'assets.pi',      category: 'Finance'       },
  { name: 'Fundx',       emoji: '📊', domain: 'fundx.pi',       category: 'Finance'       },
  { name: 'Dx',          emoji: '🏥', domain: 'dx.pi',          category: 'Health'        },
  { name: 'Analytics',   emoji: '📈', domain: 'analytics.pi',   category: 'Business'      },
  { name: 'Nbf',         emoji: '🏦', domain: 'nbf.pi',         category: 'Finance'       },
  { name: 'Epic',        emoji: '🎮', domain: 'epic.pi',        category: 'Entertainment' },
  { name: 'Legend',      emoji: '⭐', domain: 'legend.pi',      category: 'Premium'       },
  { name: 'Connection',  emoji: '🔗', domain: 'connection.pi',  category: 'Social'        },
  { name: 'System',      emoji: '⚙️', domain: 'system.pi',      category: 'Tech'          },
  { name: 'Alert',       emoji: '🔔', domain: 'alert.pi',       category: 'Tech'          },
  { name: 'Tec',         emoji: '👑', domain: 'tec.pi',         category: 'Premium'       },
  { name: 'Estate',      emoji: '🏠', domain: 'estate.pi',      category: 'Premium'       },
  { name: 'Nx',          emoji: '🚀', domain: 'nx.pi',          category: 'Tech'          },
  { name: 'Explorer',    emoji: '✈️', domain: 'explorer.pi',    category: 'Premium'       },
  { name: 'Nexus',       emoji: '🌐', domain: 'nexus.pi',       category: 'Hub'           },
  { name: 'Brookfield',  emoji: '🏙️', domain: 'brookfield.pi',  category: 'Premium'       },
  { name: 'Vip',         emoji: '💎', domain: 'vip.pi',         category: 'Premium'       },
  { name: 'Titan',       emoji: '🦾', domain: 'titan.pi',       category: 'Business'      },
  { name: 'Zone',        emoji: '🎯', domain: 'zone.pi',        category: 'Personal'      },
  { name: 'Elite',       emoji: '🏆', domain: 'elite.pi',       category: 'Premium'       },
];

const LIVE_APPS: Record<string, string> = {
  'Assets':   'https://assets.tecosystem.app',
  'Commerce': 'https://tec-commerce-app.vercel.app',
};

const CATEGORIES = [
  'All', 'Finance', 'Premium', 'Business', 'Tech',
  'Personal', 'Health', 'Entertainment', 'Social', 'Hub',
];

const CATEGORY_COLORS: Record<string, string> = {
  Finance:       '#f0c040',
  Premium:       '#d4af37',
  Business:      '#7eb8f7',
  Tech:          '#7ee7c0',
  Personal:      '#f09898',
  Health:        '#98e0a8',
  Entertainment: '#c898f0',
  Social:        '#f0b878',
  Hub:           '#ffffff',
};

export default function HomePage() {
  const { t, dir }                          = useTranslation();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');

  const filteredApps = useMemo(() => {
    let result = APPS;
    if (activeCategory !== 'All') {
      result = result.filter((app) => app.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.domain.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q) ||
          (t.apps[app.name as keyof typeof t.apps] ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, searchQuery, t]);

  const openApp = (app: typeof APPS[0]) => {
    const liveUrl = LIVE_APPS[app.name];
    if (liveUrl) {
      window.location.href = `/api/auth/sso?target=${encodeURIComponent(liveUrl)}`;
      return;
    }
    window.open(`https://${app.domain}`, '_blank', 'noopener,noreferrer');
  };

  const handleKey = (e: React.KeyboardEvent, app: typeof APPS[0]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openApp(app);
    }
  };

  const createRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    const card   = e.currentTarget;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width  = ripple.style.height = `${size}px`;
    ripple.style.left   = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top    = `${e.clientY - rect.top  - size / 2}px`;
    card.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  };

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
        <div className={styles.navLogo}>
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
          {t.home.description}
          <br />
          {t.home.subDescription}
        </p>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>24</span>
            <span className={styles.heroStatLabel}>{t.home.stats.apps}</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>47M+</span>
            <span className={styles.heroStatLabel}>{t.home.stats.piUsers}</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>1</span>
            <span className={styles.heroStatLabel}>{t.home.stats.identity}</span>
          </div>
        </div>
      </section>

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

      {/* Featured Nexus */}
      <section className={styles.featuredSection}>
        <div className={styles.featuredCard}>
          <span className={styles.featuredEmoji}>🌐</span>
          <h2 className={styles.featuredTitle}>TEC Nexus</h2>
          <p className={styles.featuredDesc}>{t.apps.Nexus}</p>
          <button
            className={styles.featuredBtn}
            onClick={() => window.open('https://nexus.pi', '_blank', 'noopener,noreferrer')}
          >
            {dir === 'rtl' ? 'استكشف Nexus ←' : 'Explore Nexus →'}
          </button>
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosystem" className={styles.ecosystemSection}>
        <div className={styles.ecosystemHeader}>
          <p className={styles.sectionEyebrow}>{t.home.ecosystem}</p>
          <h2 className={styles.sectionTitle}>
            {t.home.ecosystemTitle.split('—')[0]}—{' '}
            <span className={styles.goldText}>{t.home.ecosystemTitle.split('—')[1]}</span>
          </h2>
          <p className={styles.sectionDesc}>{t.home.description}</p>
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

        {/* Category Filter */}
        <div className={styles.filterBar}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`${styles.filterBtn} ${activeCategory === cat ? styles.filterBtnActive : ''}`}
            >
              {cat}
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
              onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
            >
              {dir === 'rtl' ? 'مسح البحث' : 'Clear search'}
            </button>
          </div>
        ) : (
          <div className={styles.appsGrid}>
            {filteredApps.map((app, i) => {
              const isLive = !!LIVE_APPS[app.name];
              return (
                <div
                  key={app.name}
                  className={styles.appCard}
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    '--cat-color': CATEGORY_COLORS[app.category] ?? '#d4af37',
                    ...(isLive ? { border: '1px solid #7ee7c040' } : {}),
                  } as React.CSSProperties}
                  onClick={(e) => { createRipple(e); openApp(app); }}
                  onKeyDown={(e) => handleKey(e, app)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.appCardGlow} />
                  <div className={styles.appCardTop}>
                    <span className={styles.appEmoji}>{app.emoji}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span
                        className={styles.appCategory}
                        style={{ color: CATEGORY_COLORS[app.category] ?? '#d4af37' }}
                      >
                        {app.category}
                      </span>
                      {isLive && (
                        <span style={{
                          fontSize: 8, color: '#7ee7c0', letterSpacing: 1,
                          background: '#7ee7c010', border: '1px solid #7ee7c030',
                          borderRadius: 4, padding: '1px 4px',
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={styles.appName}>{app.name}</span>
                  <span className={styles.appDesc}>
                    {t.apps[app.name as keyof typeof t.apps] ?? app.name}
                  </span>
                  <div className={styles.appFooter}>
                    <span className={styles.appDomain}>{app.domain}</span>
                    <span className={styles.appArrow}>{dir === 'rtl' ? '←' : '→'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className={styles.appCount}>{filteredApps.length} {t.home.stats.apps}</p>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
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
