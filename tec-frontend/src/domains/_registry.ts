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
    valueProp:        { en: 'Your identity + wallet for the whole Pi economy — one login opens every TEC app.', ar: 'هويتك ومحفظتك لكل اقتصاد باي — تسجيل دخول واحد يفتحلك كل تطبيقات TEC.' },
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
    emoji:            '🧭',
    description:      { en: 'Coordination Runtime — Workflows · Routing · Sagas', ar: 'زمن التنسيق — مسارات عمل وتوجيه' },
    valueProp:        { en: 'Ties your actions across apps together, so multi-step things just work.', ar: 'بيربط أفعالك عبر التطبيقات، فأي عملية من كذا خطوة تمشي لوحدها.' },
    // Shipped July 2026 (tec-nexus — C-109 Coordination Runtime: "What should happen next?"; V0 scaffold + Nexus Pro + C-123 login)
    status:           'live',
    layer:            'connector',
    group:            'platform',
    route:            'https://nexus.tecosystem.app/app',
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'nexus-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'auth', 'realtime'],
    dependsOnDomains: [],
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
    valueProp:        { en: 'Own and manage your Pi-native assets — NFTs, domains and more — in one wallet.', ar: 'تملّك وادِر أصولك على باي — NFTs ونطاقات وغيرها — في محفظة واحدة.' },
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
    valueProp:        { en: 'Sell or buy with Pi — real orders, checkout and a live marketplace.', ar: 'بيع واشترِ بالباي — طلبات حقيقية ودفع وسوق شغّال.' },
    status:           'live',
    layer:            'core',
    group:            'platform',
    route:            'https://commerce.tecosystem.app/app',
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
    name:             { en: 'FundX', ar: 'فاندكس' },
    piDomain:         'fundx.pi',
    emoji:            '📈',
    description:      { en: 'Capital Coordination — Pools · Charters · Co-invest', ar: 'تنسيق رأس المال — تجميعات وحوكمة' },
    valueProp:        { en: 'Learn how Pi capital pools work — browse educational pool charters, no risk yet.', ar: 'اعرف إزاي تجميعات رأس المال بالباي بتشتغل — اتصفّح مواثيق تعليمية من غير مخاطرة دلوقتي.' },
    // Shipped July 2026 (tec-fundx — C-113 Capital Coordination; V0 scaffold + FundX Pro +
    // read-only educational pool charters. Real contributions hard-gated: legal + KYC + SYSTEM, §11)
    status:           'live',
    layer:            'domain',
    group:            'finance',
    route:            'https://fundx.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'fundx-bff', paymentMode: 'none' },
    capabilities:     ['wallet', 'payments', 'kyc'],
    dependsOnDomains: [],
    sdk:              { scopes: ['investments:manage', 'wallet:read', 'payments:write'] },
    order:            10,
    ownership:        { team: 'finance' },
  },

  nbf: {
    slug:             'nbf',
    name:             { en: 'NBF', ar: 'إن بي إف' },
    piDomain:         'nbf.pi',
    emoji:            '🏢',
    description:      { en: 'Business Foundation — Establish · Verify · Launch', ar: 'تأسيس الأعمال — أنشئ ووثّق وأطلق' },
    valueProp:        { en: 'Start a verified Pi business in minutes — the entity that actually transacts.', ar: 'ابدأ نشاط تجاري موثّق على باي في دقائق — الكيان اللي بيعامل فعلاً.' },
    // Shipped July 2026 (tec-nbf — C-124 Business Foundation Runtime: "How do I
    // start my business in the Pi economy?"). Network Business Foundation: create
    // a verified business identity in 25 min (the entity that transacts). V0/V1
    // read-only: launch funnel + templates + graduation-to-Titan. NBF establishes;
    // Zone verifies, Commerce sells, Titan is the graduation target — realigned
    // from a "Neo Banking" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'finance',
    route:            'https://nbf.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'nbf-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['zone', 'commerce'],
    sdk:              { scopes: ['business:manage', 'profile:read'] },
    order:            11,
    ownership:        { team: 'finance' },
  },

  insure: {
    slug:             'insure',
    name:             { en: 'Insure', ar: 'تأمين' },
    piDomain:         'insure.pi',
    emoji:            '🛡️',
    description:      { en: 'Risk Protection — Risk Score · Escrow · Recovery', ar: 'حماية المخاطر — تقييم · ضمان · استرداد' },
    valueProp:        { en: 'See your risk score and the protections around your Pi activity.', ar: 'شوف تقييم المخاطر بتاعك والحماية حوالين نشاطك على باي.' },
    // Shipped July 2026 (tec-insure — C-129 Risk Protection Runtime: "How do I
    // protect myself, my assets, my activities?"). V0/V1 read-only preview: risk
    // score + protection surfaces (escrow · dispute · recovery · beneficiary) +
    // Insure Pro. Insure is a RISK PLATFORM, not an insurance company (no policies/
    // underwriting, V1-V2). Escrow custody is HARD-GATED to payment-service
    // (Invariant #8) — realigned from a "Policies · Claims" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'finance',
    route:            'https://insure.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'insure-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments'],
    dependsOnDomains: ['commerce', 'zone'],
    sdk:              { scopes: ['risk:read', 'escrow:read'] },
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
    valueProp:        { en: 'Shop Pi-native stores — real products, storefronts and delivery.', ar: 'اتسوّق من متاجر باي — منتجات حقيقية وواجهات وتوصيل.' },
    status:           'live',
    layer:            'domain',
    group:            'commerce',
    route:            'https://ecommerce.tecosystem.app/shop',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'ecommerce-bff', paymentMode: 'pi-platform' },
    capabilities:     ['commerce', 'payments'],
    dependsOnDomains: ['tec'],
    sdk:              { scopes: ['storefront:manage', 'orders:read', 'checkout:write'] },
    order:            20,
    ownership:        { team: 'commerce' },
  },

  // ── Real World ────────────────────────────────────────────────

  estate: {
    slug:             'estate',
    name:             { en: 'Estate', ar: 'العقارات' },
    piDomain:         'estate.pi',
    emoji:            '🏡',
    description:      { en: 'Real Estate OS — Own · Lease · Invest · Manage', ar: 'نظام تشغيل عقاري — تملّك وتأجير واستثمار وإدارة' },
    valueProp:        { en: 'Explore property on Pi — own, lease, invest and manage, all in one place.', ar: 'استكشف العقارات على باي — تملّك وأجّر واستثمر وادِر في مكان واحد.' },
    // Shipped July 2026 (tec-estate — C-114 Real Estate OS: full property lifecycle;
    // V0 scaffold + Estate Pro + read-only sample portfolio. Services only — no full
    // property purchase in Pi, no title transfer (C-114 §4/§6))
    status:           'live',
    layer:            'domain',
    group:            'real_world',
    route:            'https://estate.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'estate-bff', paymentMode: 'none' },
    capabilities:     ['assets', 'payments', 'kyc'],
    dependsOnDomains: [],
    sdk:              { scopes: ['listings:manage', 'assets:write', 'payments:write'] },
    order:            30,
    ownership:        { team: 'real-world' },
  },

  brookfield: {
    slug:             'brookfield',
    name:             { en: 'Brookfield', ar: 'بروكفيلد' },
    piDomain:         'brookfield.pi',
    emoji:            '🏗️',
    description:      { en: 'Infrastructure Runtime — Institutional assets', ar: 'منصة البنية التحتية — أصول مؤسسية' },
    valueProp:        { en: 'Explore institutional-grade assets and see who owns each project.', ar: 'استكشف الأصول المؤسسية وشوف مين بيملك كل مشروع.' },
    // Shipped July 2026 (tec-brookfield — C-131 Infrastructure Runtime: "Who owns
    // the project?"). System of Institutional Assets (B2B/B2I) — the institutional
    // counterpart to Estate (B2C) + the missing middle between FundX (raise) and
    // Estate (sell units). V0/V1 SIMULATED read-only portfolio + governance.
    // Custody + Legal hard-gated (securities/REIT): no real Pi/investment/REIT
    // until legal + payment-service custody + SYSTEM + FundX V2. Owns asset +
    // governance records only — realigned from a "Property Management" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'real_world',
    route:            'https://brookfield.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'brookfield-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['fundx', 'estate', 'zone'],
    sdk:              { scopes: ['asset:read', 'governance:read'] },
    order:            31,
    ownership:        { team: 'real-world' },
  },

  explorer: {
    slug:             'explorer',
    name:             { en: 'Explorer', ar: 'المستكشف' },
    piDomain:         'explorer.pi',
    emoji:            '🧭',
    description:      { en: 'Discovery — Find Pi-accepting businesses & opportunities', ar: 'اكتشاف — ابحث عن الأنشطة والفرص التي تقبل باي' },
    valueProp:        { en: 'Find real businesses and opportunities that accept Pi near you.', ar: 'لاقِ أنشطة وفرص حقيقية بتقبل باي قريبة منك.' },
    // Shipped July 2026 (tec-explorer — C-108 Economic Discovery Infrastructure:
    // search Pi-accepting businesses/services/opportunities, trust-first ranking;
    // V0/V1 scaffold + Explorer Business Pro + read-only sample directory. Explorer
    // indexes + ranks — it never mints verification (kyc), trust (Connection), or
    // processes merchant payments (payment-service) (C-108 §4). Note: this slug was
    // previously a Travel/Booking placeholder; realigned to the C-108 charter.
    status:           'live',
    layer:            'domain',
    group:            'real_world',
    route:            'https://explorer.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'explorer-bff', paymentMode: 'none' },
    capabilities:     ['payments', 'identity'],
    dependsOnDomains: ['commerce'],
    sdk:              { scopes: ['discovery:read', 'listings:manage'] },
    order:            32,
    ownership:        { team: 'real-world' },
  },

  // ── Social ────────────────────────────────────────────────────

  connection: {
    slug:             'connection',
    name:             { en: 'Connection', ar: 'الاتصال' },
    piDomain:         'connection.pi',
    emoji:            '🔗',
    description:      { en: 'Relationship graph — Connections · Trust · Collaboration', ar: 'رسم العلاقات — روابط وثقة وتعاون' },
    valueProp:        { en: 'Build your trusted network — connections, trust and collaboration on Pi.', ar: 'ابنِ شبكتك الموثوقة — روابط وثقة وتعاون على باي.' },
    // Shipped July 2026 (tec-connection — C-107 System of Record: the Trust Graph; Phase 0 shell + C-123 login)
    status:           'live',
    layer:            'domain',
    group:            'social',
    route:            'https://connection.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'connection-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'realtime', 'notifications'],
    dependsOnDomains: [],
    sdk:              { scopes: ['social:manage', 'messaging:write', 'realtime:read'] },
    order:            40,
    ownership:        { team: 'social' },
  },

  zone: {
    slug:             'zone',
    name:             { en: 'Zone', ar: 'المنطقة' },
    piDomain:         'zone.pi',
    emoji:            '🛡️',
    description:      { en: 'Verification Runtime — Verify · Evidence · Trust', ar: 'زمن التحقق — تحقّق وأدلة وثقة' },
    valueProp:        { en: 'Check what\'s verified and trusted before you deal — evidence, not claims.', ar: 'اتأكد إيه اللي موثّق قبل ما تتعامل — أدلة مش ادعاءات.' },
    // Shipped July 2026 (tec-zone — C-120 Verification Runtime: "What can be trusted?"; V0 scaffold + Zone Pro + C-123 login)
    status:           'live',
    layer:            'domain',
    group:            'social',
    route:            'https://zone.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'zone-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'realtime'],
    dependsOnDomains: [],
    sdk:              { scopes: ['communities:manage', 'events:write'] },
    order:            41,
    ownership:        { team: 'social' },
  },

  life: {
    slug:             'life',
    name:             { en: 'Life', ar: 'الحياة' },
    piDomain:         'life.pi',
    emoji:            '🌱',
    description:      { en: 'Personal context — Goals · Preferences · Activity', ar: 'السياق الشخصي — أهداف وتفضيلات ونشاط' },
    valueProp:        { en: 'Set your goals and preferences so the ecosystem works for you — privately.', ar: 'حدّد أهدافك وتفضيلاتك عشان المنظومة تشتغل لصالحك، وبخصوصية.' },
    // Shipped July 2026 (tec-life — C-106 System of Record: Goals/Preferences + Activity, C-123 login)
    status:           'live',
    layer:            'domain',
    group:            'social',
    route:            'https://life.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'life-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'notifications'],
    dependsOnDomains: [],
    sdk:              { scopes: ['lifestyle:manage', 'wellness:read'] },
    order:            42,
    ownership:        { team: 'social' },
  },

  // ── Tech ──────────────────────────────────────────────────────

  dx: {
    slug:             'dx',
    name:             { en: 'DX', ar: 'تجربة المطور' },
    piDomain:         'dx.pi',
    emoji:            '🛠️',
    description:      { en: 'Developer Platform — SDKs · Templates · Capabilities · Guides', ar: 'منصّة المطورين — SDKs وقوالب وقدرات وأدلّة' },
    valueProp:        { en: 'Build on Pi fast — SDKs, templates and copy-paste guides for developers.', ar: 'ابنِ على باي بسرعة — SDKs وقوالب وأدلّة جاهزة للمطورين.' },
    // Shipped July 2026 (tec-dx — C-115 System of Construction: distributes the
    // SDKs, starter templates, certified capabilities (from SYSTEM/C-94) + guides.
    // V0/V1 read-only Developer Portal + DX Builder Pro. DX distributes — it never
    // certifies capabilities (SYSTEM does) or secures the gateway (§4).
    status:           'live',
    layer:            'domain',
    group:            'tech',
    route:            'https://dx.tecosystem.app/app',
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'dx-bff', paymentMode: 'none' },
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
    emoji:            '🧩',
    description:      { en: 'Opportunity Exchange — Jobs · Partnerships · Grants · Hackathons', ar: 'بورصة الفرص — وظائف وشراكات ومِنَح' },
    valueProp:        { en: 'Find your next opportunity — jobs, partnerships, grants and hackathons on Pi.', ar: 'لاقِ فرصتك الجاية — وظائف وشراكات ومِنَح وهاكاثونات على باي.' },
    // Shipped July 2026 (tec-nx — C-112 repurposed by ADR-010: NX = Network /
    // Opportunity Exchange, the Pi economy's unified opportunity marketplace. V0/V1
    // read-only board + NX Pro. NX matches + presents — it never moves capital
    // (payment-service + FundX), verifies (Zone/kyc), or owns the graph (Connection).
    // The old NX cyber-security role moved to System's Security Center (ADR-010).
    status:           'live',
    layer:            'domain',
    group:            'tech',
    route:            'https://nx.tecosystem.app/app',
    features:         { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'nx-bff', paymentMode: 'none' },
    capabilities:     ['identity', 'notifications'],
    dependsOnDomains: ['connection'],
    sdk:              { scopes: ['opportunities:read', 'postings:manage'] },
    order:            51,
    ownership:        { team: 'platform' },
  },

  system: {
    slug:         'system',
    name:         { en: 'System', ar: 'النظام' },
    piDomain:     'system.pi',
    emoji:        '⚖️',
    description:  { en: 'Constitution Runtime — Policies · Tiers · Capabilities', ar: 'زمن الدستور — سياسات وطبقات وقدرات' },
    valueProp:        { en: 'See the platform\'s rules in plain terms — what\'s allowed, and why.', ar: 'شوف قواعد المنصّة ببساطة — إيه المسموح وليه.' },
    // Shipped July 2026 (tec-system — C-110 Institutional Authority / Constitution
    // Runtime: makes C-47 rules queryable + governs subscription tiers + certifies
    // capabilities (C-94). V0/V1 read-only Governance Console. SYSTEM defines +
    // audits policy; it never enforces (services self-enforce) or takes payments
    // (§4). Admin writes need an AdminActor + audit trail (backend, not the frontend).
    // Note: this slug was previously a "System Settings" placeholder; realigned to C-110.
    status:       'live',
    layer:        'domain',
    group:        'tech',
    route:        'https://system.tecosystem.app/app',
    features:     { hasNotifications: false, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:          { bff: 'system-bff', paymentMode: 'none' },
    capabilities: ['auth', 'identity'],
    sdk:          { scopes: ['policies:read', 'governance:read'] },
    order:        52,
    ownership:    { team: 'platform' },
  },

  alert: {
    slug:             'alert',
    name:             { en: 'Alert', ar: 'التنبيهات' },
    piDomain:         'alert.pi',
    emoji:            '🔔',
    description:      { en: 'Smart inbox — TEC activity + Pi community, classified', ar: 'صندوق ذكي — نشاط TEC + مجتمع باي' },
    valueProp:        { en: 'One smart inbox for everything that matters — your TEC activity + Pi news.', ar: 'صندوق ذكي واحد لكل المهم — نشاطك في TEC + أخبار باي.' },
    // Shipped July 2026 (tec-alert — C-111 extended: one smart inbox that
    // aggregates + classifies + routes signals from every TEC app AND a curated
    // Pi-community feed. V0/V1 read-only inbox + Alert Pro. Alert presents + routes;
    // it never resolves the incident (owning app), enforces security (NX), or acts
    // in governance (SYSTEM) — §4.
    status:           'live',
    layer:            'domain',
    group:            'tech',
    route:            'https://alert.tecosystem.app/app',
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
    emoji:        '📊',
    description:  { en: 'Ecosystem intelligence · metrics · trends', ar: 'ذكاء المنظومة والمقاييس' },
    valueProp:        { en: 'See the real numbers behind the Pi economy — your activity and market trends.', ar: 'شوف الأرقام الحقيقية ورا اقتصاد باي — نشاطك واتجاهات السوق.' },
    // Shipped July 2026 (tec-analytics — C-105 Phase 1 + C-123 session compliance)
    status:       'live',
    layer:        'domain',
    group:        'tech',
    route:        'https://analytics.tecosystem.app/app',
    features:     { hasNotifications: false, hasAnalytics: false, requiresKYC: false, requiresPro: false },
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
    description:      { en: 'Premium Experience — Tiers · Benefits · Concierge', ar: 'تجربة مميّزة — طبقات ومزايا وخدمة' },
    valueProp:        { en: 'Unlock premium experiences and benefits across the whole ecosystem.', ar: 'افتح تجارب ومزايا مميّزة عبر المنظومة كلها.' },
    // Shipped July 2026 (tec-vip — C-128 Premium Experience Runtime: "What
    // exclusive benefits do I receive?"). System of Privilege (cross-cutting): it
    // translates recognition + achievement into premium experience across the
    // ecosystem. V0/V1 read-only tiers + cross-app benefits + concierge + VIP
    // Standard. P5: VIP grants ELIGIBILITY; owning apps enforce value. VIP_ELITE
    // needs Elite recognition; only STANDARD is sold. Reward layer of
    // Legend→Elite→VIP — realigned from an "Exclusive Benefits" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'monetization',
    route:            'https://vip.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'vip-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['elite', 'legend'],
    sdk:              { scopes: ['membership:read', 'benefits:read'] },
    order:            60,
    ownership:        { team: 'monetization' },
  },

  elite: {
    slug:             'elite',
    name:             { en: 'Elite', ar: 'النخبة' },
    piDomain:         'elite.pi',
    emoji:            '🎖️',
    description:      { en: 'Excellence Runtime — Criteria-based recognition', ar: 'منصة التميّز — تقدير مبني على معايير' },
    valueProp:        { en: 'Earn official recognition for real achievement — never bought, only earned.', ar: 'اكسب تقدير رسمي على إنجاز حقيقي — مبيتشراش، بيتكسب بس.' },
    // Shipped July 2026 (tec-elite — C-127 Excellence Runtime: "Are you among the
    // best?"). System of Recognition: official, criteria-based recognition from
    // verified evidence — earned, NEVER bought (recognition is free). Tiers
    // BRONZE→PLATINUM; evidence from Legend, criteria from Analytics, governed by
    // System, GOLD/PLATINUM human-reviewed. V0/V1 read-only recognition home +
    // Elite Certificate (adjacent premium). Middle link of Legend→Elite→VIP —
    // realigned from a "Top Tier Membership" placeholder (that is VIP's role).
    status:           'live',
    layer:            'domain',
    group:            'monetization',
    route:            'https://elite.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'elite-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['legend', 'analytics'],
    sdk:              { scopes: ['recognition:read', 'criteria:read'] },
    order:            61,
    ownership:        { team: 'monetization' },
  },

  titan: {
    slug:             'titan',
    name:             { en: 'Titan', ar: 'تيتان' },
    piDomain:         'titan.pi',
    emoji:            '🏛️',
    description:      { en: 'Enterprise OS — Business · Team · Operations on Pi', ar: 'نظام تشغيل المؤسسات — أعمال وفريق وعمليات' },
    valueProp:        { en: 'Run your organization on Pi — team, roles and operations in one console.', ar: 'شغّل مؤسستك على باي — فريق وأدوار وعمليات في لوحة واحدة.' },
    // Shipped July 2026 (tec-titan — Enterprise Operating Platform: the B2B/
    // institutional counterpart to Life (Personal OS). Orgs manage identity, team +
    // roles, operations, commerce, procurement, reputation on Pi. V0/V1 read-only
    // enterprise console + Titan Enterprise. Titan COORDINATES + presents; it never
    // holds funds (payment-service), owns commerce (Commerce), holds capital (FundX),
    // owns assets (Assets), or mints verification (Zone) — realigned from a
    // "Power Users" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'monetization',
    route:            'https://titan.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'titan-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['tec', 'zone', 'commerce'],
    sdk:              { scopes: ['org:manage', 'team:manage'] },
    order:            62,
    ownership:        { team: 'monetization' },
  },

  legend: {
    slug:             'legend',
    name:             { en: 'Legend', ar: 'أسطورة' },
    piDomain:         'legend.pi',
    emoji:            '🏅',
    description:      { en: 'Reputation Runtime — Evidence-based reputation', ar: 'منصة السمعة — سمعة مبنية على دليل' },
    valueProp:        { en: 'Build a permanent, evidence-based reputation that follows you everywhere on Pi.', ar: 'ابنِ سمعة دائمة مبنية على دليل بتمشي معاك في كل مكان على باي.' },
    // Shipped July 2026 (tec-legend — C-126 Reputation Runtime: "What have you
    // achieved?"). System of Evidence: permanent, verifiable, portable reputation
    // from real Pi activity. Records OUTCOMES not claims (read layer; source apps
    // write, Zone verifies, Analytics computes scores). V0/V1 read-only reputation
    // profile + Legend Pro. Base of Legend→Elite→VIP — realigned from a
    // "Hall of Fame · Lifetime Access" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'monetization',
    route:            'https://legend.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'legend-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['zone', 'analytics'],
    sdk:              { scopes: ['reputation:read', 'achievements:read'] },
    order:            63,
    ownership:        { team: 'monetization' },
  },

  // ── Premium ───────────────────────────────────────────────────

  epic: {
    slug:             'epic',
    name:             { en: 'Epic', ar: 'إيبيك' },
    piDomain:         'epic.pi',
    emoji:            '🚀',
    description:      { en: 'Creation Runtime — Build · Launch · Grow projects', ar: 'منصة الإنشاء — ابنِ وأطلق ونمِّ مشاريعك' },
    valueProp:        { en: 'Turn your idea into a real project — build, launch and grow it on Pi.', ar: 'حوّل فكرتك لمشروع حقيقي — ابنيه وأطلقه ونمّيه على باي.' },
    // Shipped July 2026 (tec-epic — C-125 Creation Runtime: "What are you
    // building?"). System of Construction: create/launch/grow projects
    // (startup · community · campaign · event · challenge · program · initiative).
    // V0/V1 read-only project board + lifecycle (Epic→Zone→activity→Legend) +
    // Epic Pro. Epic OWNS creation + lifecycle; it never verifies (Zone), moves
    // capital (FundX), or records reputation (Legend) — realigned from an
    // "Events · Entertainment" placeholder.
    status:           'live',
    layer:            'domain',
    group:            'monetization',
    route:            'https://epic.tecosystem.app/app',
    features:         { hasNotifications: true, hasAnalytics: true, requiresKYC: false, requiresPro: false },
    api:              { bff: 'epic-bff', paymentMode: 'none' },
    capabilities:     ['auth', 'payments', 'identity'],
    dependsOnDomains: ['zone', 'commerce'],
    sdk:              { scopes: ['project:manage', 'team:manage'] },
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
    // Marketing SSoT (KB C-133 R6): every LIVE app must state a real user-facing
    // value proposition — no empty landing pages. Non-live apps may fill it later.
    if (d.status === 'live' && !d.valueProp?.en) {
      errors.push(`[${d.slug}] live domain missing valueProp.en (C-133 R6)`);
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
