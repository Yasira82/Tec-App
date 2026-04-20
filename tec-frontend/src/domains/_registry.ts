import type { DomainConfig } from './_types';

// ══════════════════════════════════════════════════════
//  TEC DOMAIN REGISTRY — Single Source of Truth
//  أي app جديد يتضاف هنا بس — مش في أي ملف تاني
// ══════════════════════════════════════════════════════

export const DOMAIN_REGISTRY: Record<string, DomainConfig> = {

  // ── Finance ──────────────────────────────────────────
  wallet: {
    slug:           'wallet',
    name:           'Wallet',
    piDomain:       'wallet.pi',
    emoji:          '💳',
    description:    'Pi Balance & Transactions',
    status:         'live',
    route:          '/dashboard/wallet',
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: false, requiresPro: false },
    backendService: 'tec-wallet-service',
    order:          1,
    category:       'finance',
  },

  // ── Tools ─────────────────────────────────────────────
  kyc: {
    slug:           'kyc',
    name:           'KYC',
    piDomain:       'kyc.pi',
    emoji:          '🪪',
    description:    'Verify Identity',
    status:         'live',
    route:          '/dashboard/kyc',
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-kyc-service',
    order:          2,
    category:       'tools',
  },

  assets: {
    slug:           'assets',
    name:           'Assets',
    piDomain:       'assets.pi',
    emoji:          '💎',
    description:    'Digital Assets',
    status:         'live',
    route:          '/dashboard/assets',
    features:       { hasNotifications: false, hasAnalytics: true,  requiresKYC: true,  requiresPro: false },
    backendService: 'tec-asset-service',
    order:          3,
    category:       'finance',
  },

  ai: {
    slug:           'ai',
    name:           'Assistant',
    piDomain:       'ai.pi',
    emoji:          '🤖',
    description:    'AI Assistant',
    status:         'live',
    route:          '/ai',
    features:       { hasNotifications: false, hasAnalytics: true,  requiresKYC: false, requiresPro: true  },
    backendService: 'tec-ai-service',
    order:          4,
    category:       'tools',
  },

  notifications: {
    slug:           'notifications',
    name:           'Notifications',
    piDomain:       'notify.pi',
    emoji:          '🔔',
    description:    'Push Notifications',
    status:         'live',
    route:          '/dashboard/notifications',
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-notification-service',
    order:          5,
    category:       'tools',
  },

 orders: {
  slug:           'orders',
  name:           'Orders',
  piDomain:       'orders.pi',
  emoji:          '📦',
  description:    'Your Orders',
  status:         'live',
  route:          '/dashboard/orders',
  features:       { hasNotifications: true, hasAnalytics: false, requiresKYC: false, requiresPro: false },
  backendService: 'tec-commerce-service',
  order:          5,
  category:       'commerce',
}, 
  
  // ── Commerce ──────────────────────────────────────────
  commerce: {
    slug:           'commerce',
    name:           'Commerce',
    piDomain:       'commerce.pi',
    emoji:          '🛒',
    description:    'Pi Marketplace',
    status:         'coming_soon',
    route:          '/dashboard/orders',
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: false },
    backendService: 'tec-commerce-service',
    order:          6,
    category:       'commerce',
  },

  // ── Premium ───────────────────────────────────────────
  nexus: {
    slug:           'nexus',
    name:           'Nexus',
    piDomain:       'nexus.pi',
    emoji:          '🌐',
    description:    'Web3 Hub',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-nexus-service',
    order:          7,
    category:       'premium',
  },

  fundx: {
    slug:           'fundx',
    name:           'Fundx',
    piDomain:       'fundx.pi',
    emoji:          '📊',
    description:    'Investment & Funding',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-fundx-service',
    order:          8,
    category:       'finance',
  },

  estate: {
    slug:           'estate',
    name:           'Estate',
    piDomain:       'estate.pi',
    emoji:          '🏠',
    description:    'Real Estate',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-estate-service',
    order:          9,
    category:       'commerce',
  },

  analytics: {
    slug:           'analytics',
    name:           'Analytics',
    piDomain:       'analytics.pi',
    emoji:          '📈',
    description:    'Business Analytics',
    status:         'coming_soon',
    route:          '/dashboard/analytics',
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: true  },
    backendService: 'tec-analytics-service',
    order:          10,
    category:       'tools',
  },

  connection: {
    slug:           'connection',
    name:           'Connection',
    piDomain:       'connection.pi',
    emoji:          '🔗',
    description:    'Social Network',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: false, requiresPro: false },
    backendService: 'tec-connection-service',
    order:          11,
    category:       'social',
  },

  insure: {
    slug:           'insure',
    name:           'Insure',
    piDomain:       'insure.pi',
    emoji:          '🛡️',
    description:    'Pi Insurance',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-insure-service',
    order:          12,
    category:       'finance',
  },

  vip: {
    slug:           'vip',
    name:           'Vip',
    piDomain:       'vip.pi',
    emoji:          '👑',
    description:    'VIP Membership',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-vip-service',
    order:          13,
    category:       'premium',
  },

  explorer: {
    slug:           'explorer',
    name:           'Explorer',
    piDomain:       'explorer.pi',
    emoji:          '✈️',
    description:    'Travel & Explore',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: false, requiresPro: false },
    backendService: 'tec-explorer-service',
    order:          14,
    category:       'social',
  },

  nbf: {
    slug:           'nbf',
    name:           'Nbf',
    piDomain:       'nbf.pi',
    emoji:          '🏦',
    description:    'Neo Banking',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-nbf-service',
    order:          15,
    category:       'finance',
  },

  epic: {
    slug:           'epic',
    name:           'Epic',
    piDomain:       'epic.pi',
    emoji:          '🔥',
    description:    'Epic Experiences',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: false, requiresPro: true  },
    backendService: 'tec-epic-service',
    order:          16,
    category:       'premium',
  },

  legend: {
    slug:           'legend',
    name:           'Legend',
    piDomain:       'legend.pi',
    emoji:          '⭐',
    description:    'Legend Status',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: true  },
    backendService: 'tec-legend-service',
    order:          17,
    category:       'premium',
  },

  storage: {
    slug:           'storage',
    name:           'Storage',
    piDomain:       'storage.pi',
    emoji:          '📦',
    description:    'Cloud Storage',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: true,  requiresKYC: false, requiresPro: true  },
    backendService: 'tec-storage-service',
    order:          18,
    category:       'tools',
  },

  identity: {
    slug:           'identity',
    name:           'Identity',
    piDomain:       'identity.pi',
    emoji:          '🔐',
    description:    'Digital Identity',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: true,  requiresPro: false },
    backendService: 'tec-identity-service',
    order:          19,
    category:       'tools',
  },

  security: {
    slug:           'security',
    name:           'Security',
    piDomain:       'security.pi',
    emoji:          '🛡️',
    description:    'Account Security',
    status:         'coming_soon',
    route:          '/dashboard/security',
    features:       { hasNotifications: true,  hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-auth-service',
    order:          20,
    category:       'tools',
  },

  realtime: {
    slug:           'realtime',
    name:           'Realtime',
    piDomain:       'realtime.pi',
    emoji:          '⚡',
    description:    'Live Updates',
    status:         'coming_soon',
    route:          null,
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: false, requiresPro: false },
    backendService: 'tec-realtime-service',
    order:          21,
    category:       'tools',
  },

  marketplace: {
    slug:           'marketplace',
    name:           'Marketplace',
    piDomain:       'market.pi',
    emoji:          '🏪',
    description:    'Pi Marketplace',
    status:         'coming_soon',
    route:          '/dashboard/marketplace',
    features:       { hasNotifications: true,  hasAnalytics: true,  requiresKYC: true,  requiresPro: false },
    backendService: 'tec-commerce-service',
    order:          22,
    category:       'commerce',
  },

  subscription: {
    slug:           'subscription',
    name:           'Subscription',
    piDomain:       'sub.pi',
    emoji:          '◈',
    description:    'Manage Plan',
    status:         'live',
    route:          '/dashboard/subscription',
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-auth-service',
    order:          23,
    category:       'finance',
  },

  profile: {
    slug:           'profile',
    name:           'Profile',
    piDomain:       'profile.pi',
    emoji:          '◉',
    description:    'Your Profile',
    status:         'live',
    route:          '/dashboard/profile',
    features:       { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    backendService: 'tec-identity-service',
    order:          24,
    category:       'tools',
  },
};

// ── Derived Collections ───────────────────────────────
export const ALL_DOMAINS    = Object.values(DOMAIN_REGISTRY).sort((a, b) => a.order - b.order);
export const LIVE_DOMAINS   = ALL_DOMAINS.filter(d => d.status === 'live');
export const COMING_SOON    = ALL_DOMAINS.filter(d => d.status === 'coming_soon');
export const BY_CATEGORY    = ALL_DOMAINS.reduce((acc, d) => {
  (acc[d.category] ??= []).push(d);
  return acc;
}, {} as Record<string, DomainConfig[]>);

export const getDomain = (slug: string): DomainConfig | undefined =>
  DOMAIN_REGISTRY[slug];

export const getVisibleDomains = (userKyc: boolean, userPro: boolean) =>
  ALL_DOMAINS.filter(d => {
    if (d.features.requiresKYC && !userKyc) return false;
    if (d.features.requiresPro && !userPro) return false;
    return true;
  });
