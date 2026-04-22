import type { Capability, DomainConfig, DomainGroup } from './_types';

// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN REGISTRY v4 — 24 Domains, Federated Platform
//  Single Source of Truth
//
//  Changes vs v3:
//    • i18n: All names & descriptions now bilingual (en + ar)
//    • +3 new domains: ai (core), trust (core), governance (tech)
//    • membership: now uses first-class `tiers[]` instead of children
//    • All scopes follow `resource:action` convention
//    • validateRegistry throws in CI/production builds
//    • getDomainsByCapability uses strict Capability type (no `as any`)
//    • Added helpers: getDependents, getTier
//
//  Total: 24 domains across 5 layers
//    • OS:        1  (tec)
//    • Connector: 1  (nexus)
//    • Core:      4  (assets, commerce, ai, trust)
//    • Domain:   15
//    • Meta:      3  (system, alert, analytics)
// ══════════════════════════════════════════════════════════════

export const DOMAIN_REGISTRY: Record<string, DomainConfig> = {

  // ════════════════════════════════════════════════════════════
  // LAYER 0 — OS (Control Plane)            [1 domain]
  // ════════════════════════════════════════════════════════════

  tec: {
    slug:         'tec',
    name:         { en: 'TEC', ar: 'تك' },
    piDomain:     'tec.pi',
    emoji:        '🔷',
    description:  {
      en: 'TEC OS — Auth · Routing · Feature Flags · Registry',
      ar: 'نظام تك — مصادقة · توجيه · علامات الميزات · سجل',
    },
    status:       'live',
    layer:        'os',
    group:        'platform',
    route:        '/hub',
    features:     { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:          { bff: 'tec-os-bff' },
    capabilities: ['auth', 'identity'],
    sdk:          { scopes: ['auth:manage', 'identity:read', 'feature-flags:read'] },
    order:        0,
    children:     ['hub', 'dashboard', 'ai'],
    ownership:    { team: 'platform', contact: '@yasser1728' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 1 — CONNECTOR                     [1 domain]
  // ════════════════════════════════════════════════════════════

  nexus: {
    slug:             'nexus',
    name:             { en: 'Nexus', ar: 'نيكسوس' },
    piDomain:         'nexus.pi',
    emoji:            '🌐',
    description:      {
      en: 'Identity Graph · Deep Links · App Routing',
      ar: 'رسم الهوية · روابط عميقة · توجيه التطبيقات',
    },
    status:           'coming_soon',
    layer:            'connector',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'nexus-bff' },
    capabilities:     ['identity', 'auth', 'realtime'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['identity:read', 'identity:write', 'routing:manage'] },
    order:            1,
    children:         ['identity', 'routing', 'deeplinks'],
    ownership:        { team: 'platform' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 2 — CORE CAPABILITIES             [4 domains]
  // ════════════════════════════════════════════════════════════

  assets: {
    slug:             'assets',
    name:             { en: 'Assets', ar: 'الأصول' },
    piDomain:         'assets.pi',
    emoji:            '💎',
    description:      {
      en: 'Ownership Engine — NFTs · Domains · Real Estate',
      ar: 'محرك الملكية — NFTs · نطاقات · عقارات',
    },
    status:           'live',
    layer:            'core',
    group:            'platform',
    route:            '/dashboard/assets',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'assets-bff' },
    capabilities:     ['wallet', 'payments', 'identity'],
    dependsOnDomains: ['tec', 'nexus'],
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
    description:      {
      en: 'Transaction Engine — Orders · Checkout · Marketplace',
      ar: 'محرك المعاملات — طلبات · دفع · سوق',
    },
    status:           'coming_soon',
    layer:            'core',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'commerce-bff' },
    capabilities:     ['payments', 'wallet', 'identity'],
    dependsOnDomains: ['tec', 'assets'],
    sdk:              { scopes: ['orders:manage', 'checkout:write', 'marketplace:read'] },
    order:            3,
    children:         ['orders', 'marketplace', 'checkout'],
    ownership:        { team: 'platform' },
  },

  // 🆕 AI — promoted from tec.children to a first-class core capability
  ai: {
    slug:             'ai',
    name:             { en: 'AI', ar: 'الذكاء الاصطناعي' },
    piDomain:         'ai.pi',
    emoji:            '🤖',
    description:      {
      en: 'Sovereign AI — Agents · Automation · Recommendations',
      ar: 'ذكاء سيادي — وكلاء · أتمتة · توصيات',
    },
    status:           'beta',
    layer:            'core',
    group:            'platform',
    route:            '/ai',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'ai-bff' },
    capabilities:     ['auth', 'identity', 'analytics'],
    dependsOnDomains: ['tec', 'nexus'],
    sdk:              { scopes: ['ai:read', 'ai:write', 'agents:manage'] },
    order:            4,
    children:         ['chat', 'agents', 'workflows'],
    ownership:        { team: 'platform' },
  },

  // 🆕 Trust — reputation + attestations engine (Pi mainnet critical)
  trust: {
    slug:             'trust',
    name:             { en: 'Trust', ar: 'الثقة' },
    piDomain:         'trust.pi',
    emoji:            '🛡️',
    description:      {
      en: 'Reputation Engine — Scores · Attestations · Verification',
      ar: 'محرك السمعة — تقييمات · شهادات · توثيق',
    },
    status:           'coming_soon',
    layer:            'core',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'trust-bff' },
    capabilities:     ['identity', 'kyc', 'auth'],
    dependsOnDomains: ['tec', 'nexus'],
    sdk:              { scopes: ['reputation:read', 'reputation:write', 'attestations:manage'] },
    order:            5,
    children:         ['reputation', 'attestations', 'verification'],
    ownership:        { team: 'platform' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 3 — DOMAIN APPS                   [15 domains]
  // ════════════════════════════════════════════════════════════

  // ── Finance Group ────────────────────────────────────────── [3]

  fundx: {
    slug:             'fundx',
    name:             { en: 'Fundx', ar: 'فاندكس' },
    piDomain:         'fundx.pi',
    emoji:            '📊',
    description:      {
      en: 'Investment & Funding Platform',
      ar: 'منصة الاستثمار والتمويل',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'fundx-bff' },
    capabilities:     ['wallet', 'payments', 'kyc', 'reputation'],
    dependsOnDomains: ['assets', 'commerce', 'trust'],
    sdk:              { scopes: ['investments:manage', 'wallet:read', 'payments:write'] },
    order:            10,
    ownership:        { team: 'finance' },
  },

  nbf: {
    slug:             'nbf',
    name:             { en: 'NBF', ar: 'إن بي إف' },
    piDomain:         'nbf.pi',
    emoji:            '🏦',
    description:      {
      en: 'Neo Banking — Accounts · Loans · Transfers',
      ar: 'بنك نيو — حسابات · قروض · تحويلات',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'nbf-bff' },
    capabilities:     ['wallet', 'payments', 'kyc', 'reputation'],
    dependsOnDomains: ['assets', 'trust'],
    sdk:              { scopes: ['banking:manage', 'wallet:write', 'transfers:write'] },
    order:            11,
    ownership:        { team: 'finance' },
  },

  insure: {
    slug:             'insure',
    name:             { en: 'Insure', ar: 'تأمين' },
    piDomain:         'insure.pi',
    emoji:            '🛡️',
    description:      {
      en: 'Pi Insurance — Policies · Claims · Risk',
      ar: 'تأمين باي — وثائق · مطالبات · مخاطر',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'finance',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'insure-bff' },
    capabilities:     ['wallet', 'payments', 'kyc', 'reputation'],
    dependsOnDomains: ['commerce', 'trust'],
    sdk:              { scopes: ['policies:manage', 'claims:write', 'payments:read'] },
    order:            12,
    ownership:        { team: 'finance' },
  },

  // ── Commerce Apps Group ──────────────────────────────────── [1]

  ecommerce: {
    slug:             'ecommerce',
    name:             { en: 'Ecommerce', ar: 'التجارة الإلكترونية' },
    piDomain:         'ecommerce.pi',
    emoji:            '🏬',
    description:      {
      en: 'B2C Stores — Products · Storefronts · Delivery',
      ar: 'متاجر إلى المستهلك — منتجات · واجهات · توصيل',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'commerce',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'ecommerce-bff' },
    capabilities:     ['commerce', 'payments'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['storefront:manage', 'orders:read', 'checkout:write'] },
    order:            20,
    ownership:        { team: 'commerce' },
  },

  // ── Real World Group ─────────────────────────────────────── [3]

  estate: {
    slug:             'estate',
    name:             { en: 'Estate', ar: 'العقارات' },
    piDomain:         'estate.pi',
    emoji:            '🏠',
    description:      {
      en: 'Real Estate — Buy · Sell · Rent',
      ar: 'العقارات — شراء · بيع · إيجار',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'estate-bff' },
    capabilities:     ['assets', 'payments', 'kyc'],
    dependsOnDomains: ['assets', 'commerce', 'trust'],
    sdk:              { scopes: ['listings:manage', 'assets:write', 'payments:write'] },
    order:            30,
    ownership:        { team: 'real-world' },
  },

  brookfield: {
    slug:             'brookfield',
    name:             { en: 'Brookfield', ar: 'بروكفيلد' },
    piDomain:         'brookfield.pi',
    emoji:            '🏢',
    description:      {
      en: 'Property Management — B2B · Commercial',
      ar: 'إدارة العقارات — أعمال · تجاري',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'brookfield-bff' },
    capabilities:     ['assets', 'payments', 'kyc'],
    dependsOnDomains: ['assets', 'commerce', 'estate'],
    sdk:              { scopes: ['property:manage', 'leasing:write', 'assets:read'] },
    order:            31,
    ownership:        { team: 'real-world' },
  },

  explorer: {
    slug:             'explorer',
    name:             { en: 'Explorer', ar: 'المستكشف' },
    piDomain:         'explorer.pi',
    emoji:            '✈️',
    description:      {
      en: 'Travel & Booking — Flights · Hotels · Experiences',
      ar: 'سفر وحجز — رحلات · فنادق · تجارب',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'real_world',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'explorer-bff' },
    capabilities:     ['payments', 'identity'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['booking:manage', 'payments:write'] },
    order:            32,
    ownership:        { team: 'real-world' },
  },

  // ── Social Group ─────────────────────────────────────────── [3]

  connection: {
    slug:             'connection',
    name:             { en: 'Connection', ar: 'الاتصال' },
    piDomain:         'connection.pi',
    emoji:            '🔗',
    description:      {
      en: 'Social Graph — Chat · Follow · Messaging',
      ar: 'الرسم الاجتماعي — دردشة · متابعة · رسائل',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'connection-bff' },
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
    description:      {
      en: 'Communities — Groups · Events · Forums',
      ar: 'مجتمعات — مجموعات · فعاليات · منتديات',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'zone-bff' },
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
    description:      {
      en: 'Lifestyle — Health · Wellness · Daily',
      ar: 'نمط الحياة — صحة · عافية · يومي',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'social',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'life-bff' },
    capabilities:     ['identity', 'notifications', 'ai'],
    dependsOnDomains: ['nexus', 'ai'],
    sdk:              { scopes: ['lifestyle:manage', 'wellness:read'] },
    order:            42,
    ownership:        { team: 'social' },
  },

  // ── Tech Group ───────────────────────────────────────────── [3]

  dx: {
    slug:             'dx',
    name:             { en: 'DX', ar: 'تجربة المطور' },
    piDomain:         'dx.pi',
    emoji:            '🧪',
    description:      {
      en: 'Developer Portal — APIs · SDKs · Docs',
      ar: 'بوابة المطورين — واجهات · SDK · توثيق',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'dx-bff' },
    capabilities:     ['auth', 'identity'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['api-keys:manage', 'docs:read', 'sandbox:write'] },
    order:            50,
    ownership:        { team: 'platform' },
  },

  nx: {
    slug:             'nx',
    name:             { en: 'NX', ar: 'إن إكس' },
    piDomain:         'nx.pi',
    emoji:            '🔧',
    description:      {
      en: 'Network Infrastructure — Nodes · Routing',
      ar: 'بنية الشبكة — عقد · توجيه',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'nx-bff' },
    capabilities:     ['realtime', 'auth'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['nodes:manage', 'routing:read'] },
    order:            51,
    ownership:        { team: 'platform' },
  },

  // 🆕 Governance — DAO mechanics, proposals, voting (Pi-aligned)
  governance: {
    slug:             'governance',
    name:             { en: 'Governance', ar: 'الحوكمة' },
    piDomain:         'governance.pi',
    emoji:            '🗳️',
    description:      {
      en: 'DAO — Proposals · Voting · Treasury',
      ar: 'منظمة لامركزية — مقترحات · تصويت · خزينة',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'tech',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: false },
    api:              { bff: 'governance-bff' },
    capabilities:     ['identity', 'auth', 'realtime', 'reputation', 'governance'],
    dependsOnDomains: ['tec', 'nexus', 'trust'],
    sdk:              { scopes: ['proposals:write', 'voting:write', 'treasury:read'] },
    order:            53,
    children:         ['proposals', 'voting', 'treasury'],
    ownership:        { team: 'platform' },
  },

  // ── Monetization Group ───────────────────────────────────── [2]
  //
  // 📌 NOTE: VIP / Elite / Titan / Legend collapsed into ONE domain
  // with first-class `tiers[]`. They are TIERS of the same product,
  // not separate products. Each tier preserves its identity, branding,
  // and pricing while sharing implementation, BFF, and billing flow.

  membership: {
    slug:             'membership',
    name:             { en: 'Membership', ar: 'العضوية' },
    piDomain:         'membership.pi',
    emoji:            '👑',
    description:      {
      en: 'Subscription Tiers — VIP · Elite · Titan · Legend',
      ar: 'فئات الاشتراك — VIP · Elite · Titan · Legend',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: true, requiresPro: true },
    api:              { bff: 'membership-bff' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['subscriptions:manage', 'tiers:read', 'entitlements:read'] },
    order:            60,
    tiers: [
      {
        slug: 'vip',    rank: 1,
        name: { en: 'VIP',    ar: 'في آي بي' },
        price: { amount: 10,   currency: 'PI', interval: 'month'    },
      },
      {
        slug: 'elite',  rank: 2,
        name: { en: 'Elite',  ar: 'النخبة' },
        price: { amount: 50,   currency: 'PI', interval: 'month'    },
      },
      {
        slug: 'titan',  rank: 3,
        name: { en: 'Titan',  ar: 'تيتان' },
        price: { amount: 200,  currency: 'PI', interval: 'month'    },
      },
      {
        slug: 'legend', rank: 4,
        name: { en: 'Legend', ar: 'أسطورة' },
        price: { amount: 1000, currency: 'PI', interval: 'lifetime' },
      },
    ],
    ownership: { team: 'monetization' },
  },

  epic: {
    slug:             'epic',
    name:             { en: 'Epic', ar: 'إيبيك' },
    piDomain:         'epic.pi',
    emoji:            '🔥',
    description:      {
      en: 'Epic Experiences — Events · Entertainment',
      ar: 'تجارب ملحمية — فعاليات · ترفيه',
    },
    status:           'coming_soon',
    layer:            'domain',
    group:            'monetization',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: true },
    api:              { bff: 'epic-bff' },
    capabilities:     ['payments', 'identity'],
    dependsOnDomains: ['commerce', 'membership'],
    sdk:              { scopes: ['events:manage', 'tickets:write'] },
    order:            70,
    ownership:        { team: 'monetization' },
  },

  // ════════════════════════════════════════════════════════════
  // LAYER 4 — META (Cross-cutting)          [3 domains]
  // ════════════════════════════════════════════════════════════
  //
  // 📌 NOTE: `system` and `alert` live here (not in 'domain' layer)
  // because they are platform-wide concerns, not standalone products.

  system: {
    slug:         'system',
    name:         { en: 'System', ar: 'النظام' },
    piDomain:     'system.pi',
    emoji:        '⚙️',
    description:  {
      en: 'System Settings — Config · Preferences',
      ar: 'إعدادات النظام — تكوين · تفضيلات',
    },
    status:       'coming_soon',
    layer:        'meta',
    group:        'platform',
    route:        null,
    features:     { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    api:          { bff: 'system-bff' },
    capabilities: ['auth'],
    sdk:          { scopes: ['config:manage', 'preferences:write'] },
    order:        80,
    ownership:    { team: 'platform' },
  },

  alert: {
    slug:             'alert',
    name:             { en: 'Alert', ar: 'التنبيهات' },
    piDomain:         'alert.pi',
    emoji:            '🚨',
    description:      {
      en: 'Smart Alerts — Rules · Triggers · Notifications',
      ar: 'تنبيهات ذكية — قواعد · مشغلات · إشعارات',
    },
    status:           'coming_soon',
    layer:            'meta',
    group:            'platform',
    route:            null,
    features:         { hasNotifications: true, hasAnalytics: false, requiresKYC: false, requiresPro: false },
    api:              { bff: 'alert-bff' },
    capabilities:     ['notifications', 'realtime'],
    dependsOnDomains: ['nexus'],
    sdk:              { scopes: ['alerts:manage', 'rules:write', 'notifications:read'] },
    order:            81,
    ownership:        { team: 'platform' },
  },

  analytics: {
    slug:         'analytics',
    name:         { en: 'Analytics', ar: 'التحليلات' },
    piDomain:     'analytics.pi',
    emoji:        '📈',
    description:  {
      en: 'Global Analytics — All Domains · Business Intel',
      ar: 'تحليلات شاملة — كل النطاقات · ذكاء أعمال',
    },
    status:       'coming_soon',
    layer:        'meta',
    group:        'platform',
    route:        null,
    features:     { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: true },
    api:          { bff: 'analytics-bff' },
    capabilities: ['analytics'],
    sdk:          { scopes: ['metrics:read', 'dashboards:manage', 'events:read'] },
    order:        82,
    ownership:    { team: 'platform' },
  },
};

// ══════════════════════════════════════════════════════════════
//  Derived Collections
// ══════════════════════════════════════════════════════════════

export const ALL_DOMAINS  = Object.values(DOMAIN_REGISTRY).sort((a, b) => a.order - b.order);
export const LIVE_DOMAINS = ALL_DOMAINS.filter(d => d.status === 'live');
export const BETA_DOMAINS = ALL_DOMAINS.filter(d => d.status === 'beta');
export const COMING_SOON  = ALL_DOMAINS.filter(d => d.status === 'coming_soon');

// By Layer
export const OS_LAYER        = ALL_DOMAINS.filter(d => d.layer === 'os');
export const CONNECTOR_LAYER = ALL_DOMAINS.filter(d => d.layer === 'connector');
export const CORE_LAYER      = ALL_DOMAINS.filter(d => d.layer === 'core');
export const DOMAIN_LAYER    = ALL_DOMAINS.filter(d => d.layer === 'domain');
export const META_LAYER      = ALL_DOMAINS.filter(d => d.layer === 'meta');

// By Group — type-safe with DomainGroup keys
export const BY_GROUP = ALL_DOMAINS.reduce((acc, d) => {
  (acc[d.group] ??= []).push(d);
  return acc;
}, {} as Record<DomainGroup, DomainConfig[]>);

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

/** Reverse index — find domains using a given BFF (debugging / ops). */
export const getDomainsByBFF = (bff: string) =>
  ALL_DOMAINS.filter(d => d.api.bff === bff);

/** Find all domains that consume a given capability (type-safe). */
export const getDomainsByCapability = (cap: Capability) =>
  ALL_DOMAINS.filter(d => d.capabilities.includes(cap));

/** Find domains that depend (directly) on a given domain. */
export const getDependents = (slug: string) =>
  ALL_DOMAINS.filter(d => d.dependsOnDomains?.includes(slug));

/** Get a tier object for a tiered domain by tier slug (e.g. 'vip'). */
export const getTier = (domainSlug: string, tierSlug: string) =>
  getDomain(domainSlug)?.tiers?.find(tier => tier.slug === tierSlug);

// ══════════════════════════════════════════════════════════════
//  Validation (run in dev / CI to catch registry errors early)
// ══════════════════════════════════════════════════════════════

export function validateRegistry(): string[] {
  const errors: string[] = [];
  const slugs = new Set(Object.keys(DOMAIN_REGISTRY));

  for (const [key, d] of Object.entries(DOMAIN_REGISTRY)) {
    // 1. Key/slug consistency
    if (key !== d.slug) {
      errors.push(`[${key}] registry key does not match config.slug '${d.slug}'`);
    }

    // 2. Self-dependency
    if (d.dependsOnDomains?.includes(d.slug)) {
      errors.push(`[${d.slug}] cannot depend on itself`);
    }

    // 3. Unknown domain references
    for (const dep of d.dependsOnDomains ?? []) {
      if (!slugs.has(dep)) {
        errors.push(`[${d.slug}] depends on unknown domain '${dep}'`);
      }
    }

    // 4. Required api.bff (with naming convention)
    if (!d.api?.bff) {
      errors.push(`[${d.slug}] missing required api.bff`);
    } else if (!d.api.bff.endsWith('-bff')) {
      errors.push(`[${d.slug}] api.bff '${d.api.bff}' must follow '<name>-bff' convention`);
    }

    // 5. Empty capabilities
    if (!d.capabilities?.length) {
      errors.push(`[${d.slug}] must declare at least one capability`);
    }

    // 6. Required i18n
    if (!d.name?.en) {
      errors.push(`[${d.slug}] missing required name.en`);
    }
    if (!d.description?.en) {
      errors.push(`[${d.slug}] missing required description.en`);
    }

    // 7. Tiers integrity (if present)
    if (d.tiers) {
      const tierSlugs = new Set<string>();
      const tierRanks = new Set<number>();
      for (const tier of d.tiers) {
        if (tierSlugs.has(tier.slug)) {
          errors.push(`[${d.slug}] duplicate tier slug '${tier.slug}'`);
        }
        if (tierRanks.has(tier.rank)) {
          errors.push(`[${d.slug}] duplicate tier rank ${tier.rank}`);
        }
        tierSlugs.add(tier.slug);
        tierRanks.add(tier.rank);
      }
    }
  }

  // 8. Duplicate orders
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

  return errors;
}

// Auto-run: warn in dev, throw in CI/production builds.
if (typeof process !== 'undefined') {
  const isProd = process.env?.NODE_ENV === 'production';
  const isCi   = process.env?.CI === 'true';

  const errs = validateRegistry();
  if (errs.length > 0) {
    console.error('[DOMAIN_REGISTRY] validation errors:', errs);
    if (isProd || isCi) {
      throw new Error(
        `Domain registry validation failed (${errs.length} errors). ` +
        `Fix the errors above before continuing.`
      );
    }
  }
}
