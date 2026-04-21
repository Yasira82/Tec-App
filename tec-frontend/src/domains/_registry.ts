import type { DomainConfig } from './_types';

// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN REGISTRY v2 — Production-grade
//  Single Source of Truth for all 24 Domains
// ══════════════════════════════════════════════════════════════

export const DOMAIN_REGISTRY: Record<string, DomainConfig> = {

  // ════════════════════════════════════════════════════════════
  // LAYER 0 — OS (Control Plane)
  // ════════════════════════════════════════════════════════════

  tec: {
    slug:           'tec',
    name:           'TEC',
    piDomain:       'tec.pi',
    emoji:          '🔷',
    description:    'TEC OS — Auth · Routing · Feature Flags · Registry',
    status:         'live',
    layer:          'os',
    group:          'platform',
    route:          '/hub',
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'identity'],
    order:          0,
    children:       ['hub', 'dashboard', 'ai'],
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 1 — CONNECTOR
  // ════════════════════════════════════════════════════════════

  nexus: {
    slug:           'nexus',
    name:           'Nexus',
    piDomain:       'nexus.pi',
    emoji:          '🌐',
    description:    'Identity Graph · Deep Links · App Routing',
    status:         'coming_soon',
    layer:          'connector',
    group:          'platform',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    backendService: 'tec-identity-service',
    dependsOn:      ['identity', 'auth', 'realtime'],
    order:          1,
    children:       ['identity', 'routing', 'deeplinks'],
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 2 — CORE CAPABILITIES (Engine Layer)
  // ════════════════════════════════════════════════════════════

  assets: {
    slug:           'assets',
    name:           'Assets',
    piDomain:       'assets.pi',
    emoji:          '💎',
    description:    'Ownership Engine — NFTs · Domains · Real Estate',
    status:         'live',
    layer:          'core',
    group:          'platform',
    route:          '/dashboard/assets',
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    backendService: 'tec-asset-service',
    dependsOn:      ['wallet', 'payment', 'identity'],
    order:          2,
    children:       ['wallet', 'digital-assets', 'portfolio'],
  },

  commerce: {
    slug:           'commerce',
    name:           'Commerce',
    piDomain:       'commerce.pi',
    emoji:          '🛒',
    description:    'Transaction Engine — Orders · Checkout · Marketplace',
    status:         'coming_soon',
    layer:          'core',
    group:          'platform',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    backendService: 'tec-commerce-service',
    dependsOn:      ['payment', 'wallet', 'identity'],
    order:          3,
    children:       ['orders', 'marketplace', 'checkout'],
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 3 — DOMAIN APPS
  // ════════════════════════════════════════════════════════════

  // ── Finance Group ─────────────────────────────────────────

  fundx: {
    slug:           'fundx',
    name:           'Fundx',
    piDomain:       'fundx.pi',
    emoji:          '📊',
    description:    'Investment & Funding Platform',
    status:         'coming_soon',
    layer:          'domain',
    group:          'finance',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-payment-service',
    dependsOn:      ['wallet', 'payment', 'kyc'],
    order:          10,
  },

  nbf: {
    slug:           'nbf',
    name:           'Nbf',
    piDomain:       'nbf.pi',
    emoji:          '🏦',
    description:    'Neo Banking — Accounts · Loans · Transfers',
    status:         'coming_soon',
    layer:          'domain',
    group:          'finance',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-wallet-service',
    dependsOn:      ['wallet', 'payment', 'kyc'],
    order:          11,
  },

  insure: {
    slug:           'insure',
    name:           'Insure',
    piDomain:       'insure.pi',
    emoji:          '🛡️',
    description:    'Pi Insurance — Policies · Claims · Risk',
    status:         'coming_soon',
    layer:          'domain',
    group:          'finance',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-payment-service',
    dependsOn:      ['wallet', 'payment', 'kyc'],
    order:          12,
  },

  // ── Commerce Apps Group ────────────────────────────────────

  ecommerce: {
    slug:           'ecommerce',
    name:           'Ecommerce',
    piDomain:       'ecommerce.pi',
    emoji:          '🏬',
    description:    'B2C Stores — Products · Storefronts · Delivery',
    status:         'coming_soon',
    layer:          'domain',
    group:          'commerce',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-commerce-service',
    dependsOn:      ['commerce', 'payment'],
    order:          20,
  },

  // ── Real World Group ───────────────────────────────────────

  estate: {
    slug:           'estate',
    name:           'Estate',
    piDomain:       'estate.pi',
    emoji:          '🏠',
    description:    'Real Estate — Buy · Sell · Rent',
    status:         'coming_soon',
    layer:          'domain',
    group:          'real_world',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-commerce-service',
    dependsOn:      ['assets', 'payment', 'kyc'],
    order:          30,
  },

  brookfield: {
    slug:           'brookfield',
    name:           'Brookfield',
    piDomain:       'brookfield.pi',
    emoji:          '🏢',
    description:    'Property Management — B2B · Commercial',
    status:         'coming_soon',
    layer:          'domain',
    group:          'real_world',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-commerce-service',
    dependsOn:      ['assets', 'payment', 'kyc'],
    order:          31,
  },

  explorer: {
    slug:           'explorer',
    name:           'Explorer',
    piDomain:       'explorer.pi',
    emoji:          '✈️',
    description:    'Travel & Booking — Flights · Hotels · Experiences',
    status:         'coming_soon',
    layer:          'domain',
    group:          'real_world',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-commerce-service',
    dependsOn:      ['payment', 'identity'],
    order:          32,
  },

  // ── Social Group ───────────────────────────────────────────

  connection: {
    slug:           'connection',
    name:           'Connection',
    piDomain:       'connection.pi',
    emoji:          '🔗',
    description:    'Social Graph — Chat · Follow · Messaging',
    status:         'coming_soon',
    layer:          'domain',
    group:          'social',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-realtime-service',
    dependsOn:      ['identity', 'realtime', 'notification'],
    order:          40,
  },

  zone: {
    slug:           'zone',
    name:           'Zone',
    piDomain:       'zone.pi',
    emoji:          '🌎',
    description:    'Communities — Groups · Events · Forums',
    status:         'coming_soon',
    layer:          'domain',
    group:          'social',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-realtime-service',
    dependsOn:      ['identity', 'realtime'],
    order:          41,
  },

  life: {
    slug:           'life',
    name:           'Life',
    piDomain:       'life.pi',
    emoji:          '❤️',
    description:    'Lifestyle — Health · Wellness · Daily',
    status:         'coming_soon',
    layer:          'domain',
    group:          'social',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    backendService: 'tec-identity-service',
    dependsOn:      ['identity', 'notification'],
    order:          42,
  },

  // ── Tech Group ─────────────────────────────────────────────

  dx: {
    slug:           'dx',
    name:           'Dx',
    piDomain:       'dx.pi',
    emoji:          '🧪',
    description:    'Developer Portal — APIs · SDKs · Docs',
    status:         'coming_soon',
    layer:          'domain',
    group:          'tech',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'identity'],
    order:          50,
  },

  nx: {
    slug:           'nx',
    name:           'Nx',
    piDomain:       'nx.pi',
    emoji:          '🔧',
    description:    'Network Infrastructure — Nodes · Routing',
    status:         'coming_soon',
    layer:          'domain',
    group:          'tech',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    backendService: 'tec-realtime-service',
    dependsOn:      ['realtime', 'auth'],
    order:          51,
  },

  system: {
    slug:           'system',
    name:           'System',
    piDomain:       'system.pi',
    emoji:          '⚙️',
    description:    'System Settings — Config · Preferences',
    status:         'coming_soon',
    layer:          'domain',
    group:          'tech',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth'],
    order:          52,
  },

  alert: {
    slug:           'alert',
    name:           'Alert',
    piDomain:       'alert.pi',
    emoji:          '🚨',
    description:    'Smart Alerts — Rules · Triggers · Notifications',
    status:         'coming_soon',
    layer:          'domain',
    group:          'tech',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-notification-service',
    dependsOn:      ['notification', 'realtime'],
    order:          53,
  },

  // ── Prestige Group ─────────────────────────────────────────

  vip: {
    slug:           'vip',
    name:           'Vip',
    piDomain:       'vip.pi',
    emoji:          '👑',
    description:    'VIP Tier — Exclusive Benefits & Access',
    status:         'coming_soon',
    layer:          'domain',
    group:          'prestige',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'payment'],
    order:          60,
  },

  elite: {
    slug:           'elite',
    name:           'Elite',
    piDomain:       'elite.pi',
    emoji:          '🥇',
    description:    'Elite Status — Top Tier Membership',
    status:         'coming_soon',
    layer:          'domain',
    group:          'prestige',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'payment'],
    order:          61,
  },

  titan: {
    slug:           'titan',
    name:           'Titan',
    piDomain:       'titan.pi',
    emoji:          '⚔️',
    description:    'Titan — Power Users · Max Privileges',
    status:         'coming_soon',
    layer:          'domain',
    group:          'prestige',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'payment'],
    order:          62,
  },

  legend: {
    slug:           'legend',
    name:           'Legend',
    piDomain:       'legend.pi',
    emoji:          '⭐',
    description:    'Legend — Hall of Fame · Lifetime Access',
    status:         'coming_soon',
    layer:          'domain',
    group:          'prestige',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    backendService: 'tec-auth-service',
    dependsOn:      ['auth', 'payment'],
    order:          63,
  },

  // ── Premium Group ──────────────────────────────────────────

  epic: {
    slug:           'epic',
    name:           'Epic',
    piDomain:       'epic.pi',
    emoji:          '🔥',
    description:    'Epic Experiences — Events · Entertainment',
    status:         'coming_soon',
    layer:          'domain',
    group:          'premium',
    route:          null,
    features:       { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    backendService: 'tec-asset-service',
    dependsOn:      ['payment', 'identity'],
    order:          70,
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 4 — META (Cross-cutting)
  // ════════════════════════════════════════════════════════════

  analytics: {
    slug:           'analytics',
    name:           'Analytics',
    piDomain:       'analytics.pi',
    emoji:          '📈',
    description:    'Global Analytics — All Domains · Business Intel',
    status:         'coming_soon',
    layer:          'meta',
    group:          'platform',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: true },
    backendService: 'tec-analytics-service',
    dependsOn:      ['analytics'],
    order:          80,
  },
};

// ══════════════════════════════════════════════════════════════
//  Derived Collections
// ══════════════════════════════════════════════════════════════

export const ALL_DOMAINS   = Object.values(DOMAIN_REGISTRY).sort((a, b) => a.order - b.order);
export const LIVE_DOMAINS  = ALL_DOMAINS.filter(d => d.status === 'live');
export const COMING_SOON   = ALL_DOMAINS.filter(d => d.status === 'coming_soon');

// By Layer
export const OS_LAYER        = ALL_DOMAINS.filter(d => d.layer === 'os');
export const CONNECTOR_LAYER = ALL_DOMAINS.filter(d => d.layer === 'connector');
export const CORE_LAYER      = ALL_DOMAINS.filter(d => d.layer === 'core');
export const DOMAIN_LAYER    = ALL_DOMAINS.filter(d => d.layer === 'domain');
export const META_LAYER      = ALL_DOMAINS.filter(d => d.layer === 'meta');

// By Group
export const BY_GROUP = ALL_DOMAINS.reduce((acc, d) => {
  (acc[d.group] ??= []).push(d);
  return acc;
}, {} as Record<string, DomainConfig[]>);

// Helpers
export const getDomain = (slug: string): DomainConfig | undefined =>
  DOMAIN_REGISTRY[slug];

export const getVisibleDomains = (userKyc: boolean, userPro: boolean) =>
  ALL_DOMAINS.filter(d => {
    if (d.features.requiresKYC && !userKyc) return false;
    if (d.features.requiresPro && !userPro) return false;
    return true;
  });

export const getDomainsByGroup = (group: string) =>
  COMING_SOON.filter(d => d.group === group);
