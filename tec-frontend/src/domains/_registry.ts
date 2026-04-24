import type {
  Capability,
  DomainConfig,
  DomainGroup,
  DomainTier,
} from './_types';

// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN REGISTRY — 24 Domains
//  Single Source of Truth
// ══════════════════════════════════════════════════════════════

export const DOMAIN_REGISTRY: Record<string, DomainConfig> = {

  // ════════════════════════════════════════════════════════════
  // LAYER 0 — OS
  // ════════════════════════════════════════════════════════════

  tec: {
    slug:         'tec',
    name:         { en: 'TEC', ar: 'تك' },
    piDomain:     'tec.pi',
    emoji:        '🔷',
    description:  { en: 'TEC OS — Hub · Dashboard · AI', ar: 'نظام تك' },
    status:       'live',
    layer:        'os',
    group:        'platform',
    route:        '/hub',
    features:     { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:          { bff: 'tec-os-bff', paymentMode: 'none' },
    capabilities: ['auth', 'identity'],
    sdk:          { scopes: ['auth:manage', 'identity:read'] },
    order:        0,
    children:     ['hub', 'dashboard', 'ai'],
    ownership:    { team: 'platform', contact: '@yasser1728' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 1 — CONNECTOR
  // ════════════════════════════════════════════════════════════

  nexus: {
    slug:             'nexus',
    name:             { en: 'Nexus', ar: 'نيكسوس' },
    piDomain:         'nexus.pi',
    emoji:            '🌐',
    description:      { en: 'Identity Graph · Deep Links · App Routing', ar: 'رسم الهوية' },
    status:           'coming_soon',
    layer:            'connector',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'nexus-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'auth', 'realtime'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['identity:read', 'routing:manage'] },
    order:            1,
    ownership:        { team: 'platform' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 2 — CORE APPS
  // ════════════════════════════════════════════════════════════

  assets: {
    slug:             'assets',
    name:             { en: 'Assets', ar: 'الأصول' },
    piDomain:         'assets.pi',
    emoji:            '💎',
    description:      { en: 'Ownership Engine — NFTs · Domains · Real Estate', ar: 'محرك الملكية' },
    status:           'live',
    layer:            'core',
    group:            'platform',
    route:            '/dashboard/assets',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'assets-bff', paymentMode: 'pi-platform' },
    capabilities:     ['wallet', 'payments', 'identity'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['assets:read', 'assets:write', 'wallet:read'] },
    order:            2,
    children:         ['wallet', 'digital-assets', 'portfolio'],
    ownership:        { team: 'platform' },
  },

  commerce: {
    slug:             'commerce',
    name:             { en: 'Commerce', ar: 'التجارة' },
    piDomain:         'commerce.pi',
    emoji:            '🛒',
    description:      { en: 'Transaction Engine — Orders · Checkout · Marketplace', ar: 'محرك المعاملات' },
    status:           'coming_soon',
    layer:            'core',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'commerce-bff', paymentMode: 'pi-platform' },
    capabilities:     ['payments', 'wallet', 'identity'],
    dependsOnDomains: ['tec', 'assets'],
    sdk:              { scopes: ['orders:manage', 'checkout:write', 'marketplace:read'] },
    order:            3,
    children:         ['orders', 'marketplace', 'checkout'],
    ownership:        { team: 'platform' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 3 — 20 DOMAIN APPS
  // ════════════════════════════════════════════════════════════

  // ── Finance ──────────────────────────────────────────────────

  fundx: {
    slug:             'fundx',
    name:             { en: 'Fundx', ar: 'فاندكس' },
    piDomain:         'fundx.pi',
    emoji:            '📊',
    description:      { en: 'Investment & Funding Platform', ar: 'منصة الاستثمار' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'fundx-bff', paymentMode: 'pi-platform' },
    capabilities:     ['wallet', 'payments', 'kyc'],
    dependsOnDomains: ['assets', 'commerce'],
    sdk:              { scopes: ['investments:manage', 'wallet:read', 'payments:write'] },
    order:            10,
    ownership:        { team: 'finance' },
  },

  nbf: {
    slug:             'nbf',
    name:             { en: 'NBF', ar: 'إن بي إف' },
    piDomain:         'nbf.pi',
    emoji:            '🏦',
    description:      { en: 'Neo Banking — Accounts · Loans · Transfers', ar: 'بنك نيو' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'nbf-bff', paymentMode: 'pi-platform' },
    capabilities:     ['wallet', 'payments', 'kyc'],
    dependsOnDomains: ['assets'],
    sdk:              { scopes: ['banking:manage', 'wallet:write', 'transfers:write'] },
    order:            11,
    ownership:        { team: 'finance' },
  },

  insure: {
    slug:             'insure',
    name:             { en: 'Insure', ar: 'تأمين' },
    piDomain:         'insure.pi',
    emoji:            '🛡️',
    description:      { en: 'Pi Insurance — Policies · Claims · Risk', ar: 'تأمين باي' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'insure-bff', paymentMode: 'pi-platform' },
    capabilities:     ['wallet', 'payments', 'kyc'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['policies:manage', 'claims:write'] },
    order:            12,
    ownership:        { team: 'finance' },
  },

  // ── Commerce Apps ─────────────────────────────────────────────

  ecommerce: {
    slug:             'ecommerce',
    name:             { en: 'Ecommerce', ar: 'التجارة الإلكترونية' },
    piDomain:         'ecommerce.pi',
    emoji:            '🏬',
    description:      { en: 'B2C Stores — Products · Storefronts · Delivery', ar: 'متاجر إلى المستهلك' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'commerce',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'ecommerce-bff', paymentMode: 'pi-platform' },
    capabilities:     ['commerce', 'payments'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['storefront:manage', 'orders:read', 'checkout:write'] },
    order:            20,
    ownership:        { team: 'commerce' },
  },

  // ── Real World ────────────────────────────────────────────────

  estate: {
    slug:             'estate',
    name:             { en: 'Estate', ar: 'العقارات' },
    piDomain:         'estate.pi',
    emoji:            '🏠',
    description:      { en: 'Real Estate — Buy · Sell · Rent', ar: 'العقارات' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'estate-bff', paymentMode: 'pi-platform' },
    capabilities:     ['assets', 'payments', 'kyc'],
    dependsOnDomains: ['assets', 'commerce'],
    sdk:              { scopes: ['listings:manage', 'assets:write', 'payments:write'] },
    order:            30,
    ownership:        { team: 'real-world' },
  },

  brookfield: {
    slug:             'brookfield',
    name:             { en: 'Brookfield', ar: 'بروكفيلد' },
    piDomain:         'brookfield.pi',
    emoji:            '🏢',
    description:      { en: 'Property Management — B2B · Commercial', ar: 'إدارة العقارات' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'brookfield-bff', paymentMode: 'pi-platform' },
    capabilities:     ['assets', 'payments', 'kyc'],
    dependsOnDomains: ['assets', 'commerce', 'estate'],
    sdk:              { scopes: ['property:manage', 'leasing:write'] },
    order:            31,
    ownership:        { team: 'real-world' },
  },

  explorer: {
    slug:             'explorer',
    name:             { en: 'Explorer', ar: 'المستكشف' },
    piDomain:         'explorer.pi',
    emoji:            '✈️',
    description:      { en: 'Travel & Booking — Flights · Hotels · Experiences', ar: 'سفر وحجز' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'explorer-bff', paymentMode: 'pi-platform' },
    capabilities:     ['payments', 'identity'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['booking:manage', 'payments:write'] },
    order:            32,
    ownership:        { team: 'real-world' },
  },

  // ── Social ────────────────────────────────────────────────────

  connection: {
    slug:             'connection',
    name:             { en: 'Connection', ar: 'الاتصال' },
    piDomain:         'connection.pi',
    emoji:            '🔗',
    description:      { en: 'Social Graph — Chat · Follow · Messaging', ar: 'الرسم الاجتماعي' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'connection-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'realtime', 'notifications'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['social:manage', 'messaging:write', 'realtime:read'] },
    order:            40,
    ownership:        { team: 'social' },
  },

  zone: {
    slug:             'zone',
    name:             { en: 'Zone', ar: 'المنطقة' },
    piDomain:         'zone.pi',
    emoji:            '🌎',
    description:      { en: 'Communities — Groups · Events · Forums', ar: 'مجتمعات' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'zone-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'realtime'],
    dependsOnDomains: ['connection'],
    sdk:              { scopes: ['communities:manage', 'events:write'] },
    order:            41,
    ownership:        { team: 'social' },
  },

  life: {
    slug:             'life',
    name:             { en: 'Life', ar: 'الحياة' },
    piDomain:         'life.pi',
    emoji:            '❤️',
    description:      { en: 'Lifestyle — Health · Wellness · Daily', ar: 'نمط الحياة' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'life-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'notifications'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['lifestyle:manage', 'wellness:read'] },
    order:            42,
    ownership:        { team: 'social' },
  },

  // ── Tech ──────────────────────────────────────────────────────

  dx: {
    slug:             'dx',
    name:             { en: 'DX', ar: 'تجربة المطور' },
    piDomain:         'dx.pi',
    emoji:            '🧪',
    description:      { en: 'Developer Portal — APIs · SDKs · Docs', ar: 'بوابة المطورين' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'dx-bff', paymentMode: 'pi-platform' },
    capabilities:     ['auth', 'identity'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['api-keys:manage', 'docs:read'] },
    order:            50,
    ownership:        { team: 'platform' },
  },

  nx: {
    slug:             'nx',
    name:             { en: 'NX', ar: 'إن إكس' },
    piDomain:         'nx.pi',
    emoji:            '🔧',
    description:      { en: 'Network Infrastructure — Nodes · Routing', ar: 'بنية الشبكة' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'nx-bff', paymentMode: 'none' },
    capabilities:     ['realtime', 'auth'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['nodes:manage', 'routing:read'] },
    order:            51,
    ownership:        { team: 'platform' },
  },

  system: {
    slug:         'system',
    name:         { en: 'System', ar: 'النظام' },
    piDomain:     'system.pi',
    emoji:        '⚙️',
    description:  { en: 'System Settings — Config · Preferences', ar: 'إعدادات النظام' },
    status:       'coming_soon',
    layer:        'domain',
    group:        'tech',
    route:        null,
    features:     { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    api:          { bff: 'system-bff', paymentMode: 'none' },
    capabilities: ['auth'],
    sdk:          { scopes: ['config:manage', 'preferences:write'] },
    order:        52,
    ownership:    { team: 'platform' },
  },

  alert: {
    slug:             'alert',
    name:             { en: 'Alert', ar: 'التنبيهات' },
    piDomain:         'alert.pi',
    emoji:            '🚨',
    description:      { en: 'Smart Alerts — Rules · Triggers · Notifications', ar: 'تنبيهات ذكية' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    api:              { bff: 'alert-bff', paymentMode: 'none' },
    capabilities:     ['notifications', 'realtime'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['alerts:manage', 'rules:write', 'notifications:read'] },
    order:            53,
    ownership:        { team: 'platform' },
  },

  analytics: {
    slug:         'analytics',
    name:         { en: 'Analytics', ar: 'التحليلات' },
    piDomain:     'analytics.pi',
    emoji:        '📈',
    description:  { en: 'Global Analytics — All Domains · Business Intel', ar: 'تحليلات شاملة' },
    status:       'coming_soon',
    layer:        'domain',
    group:        'tech',
    route:        null,
    features:     { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: true },
    api:          { bff: 'analytics-bff', paymentMode: 'none' },
    capabilities: ['analytics'],
    sdk:          { scopes: ['metrics:read', 'dashboards:manage', 'events:read'] },
    order:        54,
    ownership:    { team: 'platform' },
  },

  // ── Prestige ──────────────────────────────────────────────────

  vip: {
    slug:             'vip',
    name:             { en: 'VIP', ar: 'في آي بي' },
    piDomain:         'vip.pi',
    emoji:            '👑',
    description:      { en: 'VIP Tier — Exclusive Benefits & Access', ar: 'عضوية VIP' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'vip-bff', paymentMode: 'pi-platform' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['entitlements:read', 'subscriptions:manage'] },
    order:            60,
    ownership:        { team: 'monetization' },
  },

  elite: {
    slug:             'elite',
    name:             { en: 'Elite', ar: 'النخبة' },
    piDomain:         'elite.pi',
    emoji:            '🥇',
    description:      { en: 'Elite Status — Top Tier Membership', ar: 'عضوية النخبة' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'elite-bff', paymentMode: 'pi-platform' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec', 'vip'],
    sdk:              { scopes: ['entitlements:read', 'subscriptions:manage'] },
    order:            61,
    ownership:        { team: 'monetization' },
  },

  titan: {
    slug:             'titan',
    name:             { en: 'Titan', ar: 'تيتان' },
    piDomain:         'titan.pi',
    emoji:            '⚔️',
    description:      { en: 'Titan — Power Users · Max Privileges', ar: 'تيتان' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'titan-bff', paymentMode: 'pi-platform' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec', 'elite'],
    sdk:              { scopes: ['entitlements:read', 'subscriptions:manage'] },
    order:            62,
    ownership:        { team: 'monetization' },
  },

  legend: {
    slug:             'legend',
    name:             { en: 'Legend', ar: 'أسطورة' },
    piDomain:         'legend.pi',
    emoji:            '⭐',
    description:      { en: 'Legend — Hall of Fame · Lifetime Access', ar: 'أسطورة' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'legend-bff', paymentMode: 'pi-platform' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec', 'titan'],
    sdk:              { scopes: ['entitlements:read', 'subscriptions:manage'] },
    order:            63,
    ownership:        { team: 'monetization' },
  },

  // ── Premium ───────────────────────────────────────────────────

  epic: {
    slug:             'epic',
    name:             { en: 'Epic', ar: 'إيبيك' },
    piDomain:         'epic.pi',
    emoji:            '🔥',
    description:      { en: 'Epic Experiences — Events · Entertainment', ar: 'تجارب ملحمية' },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'epic-bff', paymentMode: 'pi-platform' },
    capabilities:     ['payments', 'identity'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['events:manage', 'tickets:write'] },
    order:            70,
    ownership:        { team: 'monetization' },
  },
};

// ══════════════════════════════════════════════════════════════
//  Derived Collections
// ══════════════════════════════════════════════════════════════

export const ALL_DOMAINS  = Object.values(DOMAIN_REGISTRY).sort((a, b) => a.order - b.order);
export const LIVE_DOMAINS = ALL_DOMAINS.filter(d => d.status === 'live');
export const BETA_DOMAINS = ALL_DOMAINS.filter(d => d.status === 'beta');
export const COMING_SOON  = ALL_DOMAINS.filter(d => d.status === 'coming_soon');

export const OS_LAYER        = ALL_DOMAINS.filter(d => d.layer === 'os');
export const CONNECTOR_LAYER = ALL_DOMAINS.filter(d => d.layer === 'connector');
export const CORE_LAYER      = ALL_DOMAINS.filter(d => d.layer === 'core');
export const DOMAIN_LAYER    = ALL_DOMAINS.filter(d => d.layer === 'domain');

export const BY_GROUP = ALL_DOMAINS.reduce((acc, d) => {
  (acc[d.group] ??= []).push(d);
  return acc;
}, {} as Partial<Record<DomainGroup, DomainConfig[]>>);

export const PI_PLATFORM_DOMAINS = ALL_DOMAINS.filter(d => d.api.paymentMode === 'pi-platform');

// ══════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════

export const getDomain = (slug: string): DomainConfig | undefined =>
  DOMAIN_REGISTRY[slug];

export const getVisibleDomains = (userKyc: boolean, userPro: boolean) =>
  ALL_DOMAINS.filter(d => {
    if (d.features.requiresKYC && !userKyc) return false;
    if (d.features.requiresPro && !userPro) return false;
    return true;
  });

export const getDomainsByGroup = (group: DomainGroup) =>
  ALL_DOMAINS.filter(d => d.group === group);

export const getDependents = (slug: string) =>
  ALL_DOMAINS.filter(d => d.dependsOnDomains?.includes(slug));

// ══════════════════════════════════════════════════════════════
//  Validation
// ══════════════════════════════════════════════════════════════

export function validateRegistry(): string[] {
  const errors: string[] = [];
  const slugs = new Set(Object.keys(DOMAIN_REGISTRY));

  for (const [key, d] of Object.entries(DOMAIN_REGISTRY)) {
    if (key !== d.slug) {
      errors.push(`[${key}] registry key does not match slug '${d.slug}'`);
    }
    if (d.dependsOnDomains?.includes(d.slug)) {
      errors.push(`[${d.slug}] cannot depend on itself`);
    }
    for (const dep of d.dependsOnDomains ?? []) {
      if (!slugs.has(dep)) {
        errors.push(`[${d.slug}] depends on unknown domain '${dep}'`);
      }
    }
    if (!d.api?.bff?.endsWith('-bff')) {
      errors.push(`[${d.slug}] api.bff must follow '<name>-bff' convention`);
    }
    if (!d.capabilities?.length) {
      errors.push(`[${d.slug}] must declare at least one capability`);
    }
    if (!d.name?.en) {
      errors.push(`[${d.slug}] missing required name.en`);
    }
    if (!d.description?.en) {
      errors.push(`[${d.slug}] missing required description.en`);
    }
    if (d.api.paymentMode === 'pirc2' && (!d.tiers || d.tiers.length === 0)) {
      errors.push(`[${d.slug}] paymentMode=pirc2 requires at least one tier`);
    }
    for (const dep of d.dependsOnDomains ?? []) {
      const depDomain = DOMAIN_REGISTRY[dep];
      if (depDomain?.status === 'coming_soon' && d.status === 'live') {
        errors.push(`[${d.slug}] live domain depends on coming_soon domain '${dep}'`);
      }
    }
  }

  // Duplicate orders
  const orders = new Map<number, string[]>();
  for (const d of ALL_DOMAINS) {
    if (!orders.has(d.order)) orders.set(d.order, []);
    orders.get(d.order)!.push(d.slug);
  }
  for (const [order, owners] of orders) {
    if (owners.length > 1) {
      errors.push(`Duplicate order ${order}: ${owners.join(', ')}`);
    }
  }

  // Duplicate piDomain
  const piDomains = new Map<string, string[]>();
  for (const d of ALL_DOMAINS) {
    if (!piDomains.has(d.piDomain)) piDomains.set(d.piDomain, []);
    piDomains.get(d.piDomain)!.push(d.slug);
  }
  for (const [domain, owners] of piDomains) {
    if (owners.length > 1) {
      errors.push(`Duplicate piDomain '${domain}': ${owners.join(', ')}`);
    }
  }

  return errors;
}

if (typeof process !== 'undefined') {
  const isProd = process.env?.NODE_ENV === 'production';
  const isCi   = process.env?.CI === 'true';
  const errs   = validateRegistry();
  if (errs.length > 0) {
    console.error('[DOMAIN_REGISTRY] validation errors:', errs);
    if (isProd || isCi) {
      throw new Error(`Domain registry validation failed (${errs.length} errors).`);
    }
  }
    }
