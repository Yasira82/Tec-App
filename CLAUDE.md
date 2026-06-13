# TEC App — Claude Code Instructions

## What This Repo Is

TEC Hub — the Control Plane for the TEC Federated Platform Ecosystem.
Handles: identity authority, SSO, payment orchestration, app routing,
subscriptions, and ecosystem coordination.

**Current Phase: Phase 0 — Pre-Mainnet Hardening**

---

## Stack

- Next.js 15 App Router + TypeScript strict
- PostgreSQL + Prisma
- @yasser172/tec-ui (shared design system)
- @yasser172/tec-auth (usePiAuth, ssoRedirect)
- @yasser172/tec-sdk (server-side BFF calls only)
- packages/tec-core-sdk (browser Pi SDK hooks)
- Deployment: Vercel (frontend) + Railway (backend services)

---

## Kernel Spec — Platform Constitution (C-47)

### Core Principles

| Principle | Rule |
|-----------|------|
| P1 Single Source of Truth | Every rule defined in one place only |
| P2 No Rule Duplication | No rule defined differently in more than one layer |
| P3 Strict State Transitions | Every domain state change follows explicit lifecycle |
| P4 Event-Driven Truth | Events = facts (already happened), not actions |
| P5 Layer Responsibility | SDK=contracts, Gateway=orchestration, Services=execution |
| **P6 Fail Closed** | If doubt in identity/permission/state → **deny by default** |

> ⚠️ **P6 is the most important — non-negotiable for a financial platform**

### System Invariants (Cannot Be Broken)

```
1. Wallet balance NEVER goes negative
2. Payment cannot complete without approval
3. Identity always resolves to ONE principal
4. Every financial action has an audit trail
5. Events are immutable — never modified
6. No state mutation without actor context
7. Terminal states are final — no transitions from completed/failed/cancelled
8. Each entity has exactly one owning service
9. Non-sensitive classification does NOT exempt from logging
```

### Forbidden Behaviors (10)

```
1.  Direct DB mutation bypassing service layer
2.  Payment completion without event verification
3.  Cross-service shared database logic
4.  Business logic inside API Gateway
5.  Divergent SDK contracts vs backend behavior
6.  Silent failure in financial flows
7.  Reading another user's wallet/payment without authorization
8.  Sensitive operation accepted with missing ActorContext
9.  Transitioning from terminal payment states (completed/failed/cancelled)
10. Ad-hoc system recovery without audit trail
```

### Policy Precedence

```
1. Kernel Invariants          ← highest authority
2. Service Final Enforcement
3. Gateway Access Policy
4. SDK Pre-validation
5. UI Assumptions             ← lowest authority

Rule: No upstream layer may weaken a downstream invariant.
      SDK allows → Gateway denies   → Gateway WINS
      Gateway allows → Service rejects → Service WINS
      Service allows → Kernel violated → Operation MUST FAIL
```

### Violation Response

| Violation Type | Response | HTTP |
|----------------|----------|------|
| Invariant violation | Reject immediately | 400/403 |
| Unknown actor context | Deny by default | 401 |
| Contract mismatch (bad request) | Reject | 400/422 |
| Contract mismatch (SDK↔backend) | Fail closed | 500 + alert |
| Missing required field | Reject at Zod layer | 400 |
| Terminal state transition | Reject | 409 Conflict |
| Orphan payment state | Reconciliation path | cron 60min |

---

## Architecture Rules

### Two-SDK Boundary (DO NOT CROSS)
```
Client Components  →  packages/tec-core-sdk  (usePiAuth, useTecWallet)
API Routes (BFF)   →  @yasser172/tec-sdk     (TecSdk.payment.*, TecSdk.auth.*)
```
Never import tec-sdk npm in Client Components.
Never import axios or Pi SDK directly in API Routes.

### ADR-007 — Pi Foreign Session (CRITICAL)
When a user navigates FROM hub.tecosystem.app:
- Pi SDK is in foreign session → `Pi.authenticate()` throws
- Always check `isHubNavigation()` before any Pi call
- If hub navigation → redirect to hub payment modal

```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app')

// Before EVERY Pi payment:
if (isHubNavigation() || !window.Pi || !piReady) {
  redirectToHubModal(product)
  return
}
```

### Auth Pattern
- SSO: Hub sets HttpOnly cookies → apps read cookies
- Cookies: tec_access_token, tec_csrf, tec_user
- NEVER localStorage, NEVER sessionStorage for tokens
- CSRF token required on all POST/PUT/DELETE BFF routes

### BFF-First Rule (enforced — learned from production bug NEW-L)
All client-side data fetching MUST use `/api/bff/*` routes. Never call `/api/wallet/*`,
`/api/payments/*`, or `/api/notifications/*` directly from client hooks.

| Route | Status | Reason |
|-------|--------|--------|
| `/api/bff/wallet/balance` | ✅ USE | createHandler: cookie auth + token refresh |
| `/api/wallet/balance` | ❌ AVOID | Authorization header only — silent 0 on token expiry |
| `/api/bff/payment/*` | ✅ USE | Proper auth + audit |
| `/api/payments/history` | ✅ OK | Fallback only — has Authorization header check |

> Root cause of NEW-L: `useWallet` fetched from `/api/wallet/balance`. On token expiry,
> the route silently returned `{balance:0, walletId:null}` — Hub card worked because it
> used `/api/bff/wallet/balance` with `createHandler` and auto refresh.

---

## P1 Violations Status

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| NEW-A | SECURITY | Railway URLs in client bundle | ✅ CLOSED — hardcoded URLs removed, BFF proxy added |
| NEW-B | BLOCKING | payment-service INTERNAL_SECRET missing | ⚠️ OPS ONLY — set `INTERNAL_SECRET` on Railway for all 4 services |
| NEW-D | CRITICAL | tec-auth-service: zero tests | ✅ CLOSED — 95% stmt / 92.98% branch / 100% lines coverage |
| NEW-J | FEATURE | Ecommerce Cart Phase 2+3 | ✅ CLOSED — useCart + CartDrawer + ShopHeader badge |
| NEW-K | HUB | Hub sub-pages missing | ✅ CLOSED — /hub/kyc + /hub/subscription + /hub/notifications + /hub/profile |
| NEW-L | BUG | Wallet page shows zero balance + empty history | ✅ CLOSED — useWallet now uses /api/bff/wallet/balance (token refresh) |

**Only NEW-B remains — Railway ops task, not a code change.**

```bash
# Generate a shared secret (run once, same value for all 4 services)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Set INTERNAL_SECRET on: tec-api-gateway, tec-auth-service,
# tec-payment-service, tec-commerce-service
```

---

## Development Commands

```bash
npm run dev          # start Hub frontend
npm run build        # production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm test             # Jest tests
```

---

## File Structure

```
tec-frontend/
  src/
    app/
      hub/                       # Hub control plane pages
        layout.tsx               # Imports tec-design-tokens.css for all hub sub-pages
        page.tsx                 # Hub home — wallet card, apps grid, payment modal
        kyc/page.tsx             # /hub/kyc — KYC verification flow
        notifications/page.tsx   # /hub/notifications — notification center
        subscription/page.tsx    # /hub/subscription — FREE/PRO/ENTERPRISE plans
        profile/page.tsx         # /hub/profile — account info + quick actions
        pay/page.tsx             # /hub/pay — redirects → /hub?pay=1 (governance: never process here)
      api/
        bff/
          metrics/               # GET /api/bff/metrics — 24h payment observability
          wallet/balance/        # GET — wallet balance with auto token refresh ✅ USE THIS
          payment/               # approve / complete / resolve callbacks
          payments/              # GET history
          notifications/         # GET + mark-read
        wallet/balance/          # ⚠️ LEGACY — no token refresh, use /api/bff/wallet/balance instead
    components/
      hub/
        HubSubShell.tsx          # Shared shell for all hub sub-pages (back button + sticky header)
        HubHeader.tsx            # Hub top bar (time, notifications bell)
        HubWalletCard.tsx        # Balance card on hub home
        HubCarousel.tsx          # Carousel (Pi price, assets, commerce)
        HubAppsGrid.tsx          # App icons grid
        HubComingSoon.tsx        # Coming soon section
        index.ts                 # Barrel export
    lib-client/
      pi/
        PiRuntime.ts             # Pi Abstraction Layer (PAL) — never call window.Pi directly
        PiCircuitBreaker.ts      # Circuit breaker: 3 failures → OPEN 60s → HALF_OPEN
    styles/
      tec-design-tokens.css      # CSS variables: --tec-gold, --tec-surface-*, --tec-text-*, etc.
packages/
  tec-core-sdk/                  # Browser Pi SDK hooks (usePiAuth, useTecWallet)
  tec-ui/                        # Shared design system (@yasser172/tec-ui)
```

### BFF Route Naming Convention
```
/api/bff/wallet/balance    ← data fetch (cookie auth + token refresh)  USE THIS
/api/bff/payment/approve   ← Pi payment callback handler
/api/bff/payment/complete  ← Pi payment callback handler
/api/bff/payments/history  ← payment history list
/api/wallet/balance        ← ⚠️ LEGACY — Authorization header only, no refresh, avoid
```

---

## What NOT To Do

- Do NOT add NEXT_PUBLIC_* env vars for internal service URLs
- Do NOT call window.Pi directly — use PiRuntime.* wrapper
- Do NOT implement custom auth — use Hub SSO
- Do NOT implement custom payment logic — use tec-payment-service contracts
- Do NOT add new apps or major features during Phase 0
- Do NOT skip isHubNavigation() check before Pi payments
- Do NOT weaken a downstream invariant from an upstream layer (P6)
- Do NOT fetch data from `/api/wallet/*` or `/api/payments/*` in client hooks — use `/api/bff/*` (BFF-first rule)
- Do NOT write payment tests without mocking `/api/.../payment/create` fetch first (C-76 backend-first flow)

---

## Pi SDK Known Behaviors

- ADR-007: Foreign session when navigating from hub
- window.__TEC_PI_READY: true after Pi.init() completes
- window.__TEC_PI_FOREIGN_SESSION: true when Pi SDK initialized by hub
- Pi.init() throws "already initialized" in foreign session — handle gracefully
- Pi.authenticate() throws "not initialized" in foreign session — DO NOT call

### PAL — Pi Abstraction Layer (Objective 0.0)

```typescript
// PiRuntime interface — ALL window.Pi.* calls go through here
PiRuntime.init(appId, sandbox)         // replaces window.Pi.init
PiRuntime.authenticate(scopes, cb)     // with circuit breaker + ADR-007 check
PiRuntime.createPayment(config, cbs)   // with ownership check (C-76)
PiRuntime.canAttempt()                 // circuit breaker state check
```

### Payment Circuit Breaker (PiCircuitBreaker)
- State machine: CLOSED → (3 failures) → OPEN → (60s) → HALF_OPEN → (success) → CLOSED
- State persisted in localStorage key `tec_pi_cb`
- `piCircuitBreaker.reset()` available for manual recovery

---

## Commit Convention

```
feat(scope):   new feature
fix(scope):    bug fix
test(scope):   tests only
chore(scope):  build/config
```

---

## Platform Orchestra — TEC Federated Ecosystem

Hub is the **Conductor**. Every other repo is an instrument.

```
HUB (tec-app) ──────────── Control Plane / Conductor
  │
  ├── @yasser172/tec-auth    ← Auth package — trust backbone for ALL apps
  ├── tec-core-backend       ← All backend microservices
  ├── @yasser172/tec-sdk     ← Server BFF SDK (API routes only)
  ├── @yasser172/tec-ui      ← Shared design system (all apps)
  │
  ├── tec-ecommerce          ← Consumer marketplace  (Phase 0 ✅)
  ├── tec-assets             ← Ownership layer        (Phase 0)
  └── tec-commerce           ← Merchant dashboard     (Phase 0)
```

---

## Score Projection (C-41)

```
Now (Self):              ~8.5/10
Now (External expected): ~7.0–7.5/10
────────────────────────────────────
After Phase 0 fixes:     ~8.0 external
After Phase 1 content:   ~8.5 external
After external audit:    9.5/10 ✅ → Submit to Pi Network
```

> ⚠️ Pattern: every external audit drops score by 1.5–2.0 points.
> The real gap is larger than it appears.

---

## Engineering Roadmap (C-41)

### Phase 0 — Before Mainnet (2 weeks)

**Security:**
```
□ Fix NEW-A: const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL
□ Fix NEW-B: INTERNAL_SECRET = z.string().min(32) + process.exit(1) startup guard
```

**Hub Completion:**
```
✅ KYC UI — /hub/kyc
✅ Subscription UI — /hub/subscription (FREE/PRO/ENTERPRISE)
✅ Notifications Center — /hub/notifications
✅ Profile page completion
✅ HubSubShell — shared shell component for all hub sub-pages
✅ hub/layout.tsx — design tokens CSS for all /hub/* routes
```

**tec-ui Enhancement:**
```
□ Add createU2APayment() to @yasser172/tec-ui/payment
□ Add PaymentModal component
□ Publish v1.2.0
□ Update Commerce + Assets + Ecommerce to use shared version
```

### Phase 1 — After Mainnet (month 1–2)

```
□ tec-auth package tests ≥ 60%
□ tec-ui tests
□ Assets tests ≥ 60%
□ Ecommerce tests + document Pi App ID
□ Analytics frontend — connect to all apps
□ Hub analytics dashboard
□ Life MVP — Tec-Life repo (spending timeline, budget, cashflow)
```

### Phase 2 — Month 3–4

```
□ Connection MVP — Tec-Connection (profiles, follow, messaging)
□ Explorer MVP — Pi-accepting businesses, location search
□ Hub VIP/PRO/ENTERPRISE subscription UI
```

### Phase 3 — Month 5–8

```
□ Fundx v1 — educational pools (requires: KYC mature + legal consultation)
□ Estate v1 — property listings, search, gallery
```

### Freeze Architecture Rule (3–4 months after Mainnet)

```
FORBIDDEN after Mainnet:
  ✗ Rewriting existing services
  ✗ Adding new microservices
  ✗ SDK major version bumps
  ✗ Repo restructuring

ALLOWED:
  ✓ Hub hardening
  ✓ Life MVP
  ✓ Retention loops
  ✓ Payment reliability
  ✓ Analytics
  ✓ UX quality
```

---

## Mainnet Checklist

```
Security:
  ✅ NEW-A: Railway URLs removed — BFF proxy in place
  ⚠️ NEW-B: INTERNAL_SECRET — set on Railway (ops task)
  □ Zero P1 violations (only NEW-B remains — ops)
  □ External audit ≥ 9.5

Infrastructure:
  ✅ 12 Railway services Active
  ✅ DECIMAL(20,8) + balance >= 0
  ✅ Policy CI active
  □ PI_SANDBOX=false verified on ALL production services
  □ Pi Network developer portal submission ready

Content:
  ✅ Commerce + Assets + Ecommerce shipped
  ✅ Hub: KYC + Subscription + Notifications + Profile
  □ Tests coverage ≥ 60% (all repos)
  □ tec-ui v1.2.0 published with shared payment components

Final:
  □ External audit
  □ Fix any new audit findings
  □ Submit to Pi Network
```

---

## Common Debug Patterns

### "Page shows zero / blank data"
```
Symptom: Page renders but shows 0 balance or empty list.
         A different page (Hub card) shows correct data.

Cause:   Client hook uses /api/wallet/* or /api/payments/* directly.
         These routes use Authorization header only — silent 0 on token expiry.

Fix:     Switch hook to /api/bff/* equivalent.
         /api/bff/wallet/balance has createHandler + auto token refresh.

Example: NEW-L — useWallet /api/wallet/balance → /api/bff/wallet/balance (PR #13)
```

### "CI tests fail: Payment setup failed (422)"
```
Symptom: createU2APayment tests fail with "Payment setup failed (422)".
         Tests that mock Pi.createPayment don't reach the callback.

Cause:   C-76 backend-first flow: backend /payment/create is called BEFORE
         Pi.createPayment. Tests missing a fetch mock get a 422 and throw early.

Fix:     Add mockCreateSuccess() at top of each failing test to mock
         fetch('/api/.../payment/create') → {ok:true, data:{id:'internal-id'}}.

Example: Fixed in src/__tests__/pi-payment.test.ts (PR #12)
```

### "Hub sub-page CSS variables undefined (blank styles)"
```
Symptom: Hub sub-page renders but colors/fonts missing.
         CSS vars like var(--tec-text-1) render as transparent.

Cause:   hub/layout.tsx missing or not importing tec-design-tokens.css.
         Sub-pages need this — hub/page.tsx imports it inline but sub-pages don't.

Fix:     hub/layout.tsx must import '@/styles/tec-design-tokens.css'.
         This file exists and is correct — do not remove it.
```

### "Pi payment throws before Pi.createPayment is called"
```
Symptom: onError fires immediately without Pi wallet opening.
         Error: "Pi SDK error: scope permission denied" or similar.

Cause:   ADR-007 — Pi SDK in foreign session (navigated from hub.tecosystem.app).
         Or: piSession.ensurePaymentsReady() failed.

Fix:     Check isHubNavigation() before any Pi call.
         If true → redirect to /hub?pay=1&... (never attempt Pi directly).
```

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Pi SDK update breaks all payments | P0 | PAL — single fix point for all `window.Pi.*` calls |
| R2 | Auth-service silent regression | P1 | ≥ 60% coverage, failure scenarios covered |
| R3 | Infrastructure URLs in client bundle | P1 | NEW-A fix — no `NEXT_PUBLIC_*` for internal URLs |
| R4 | Capacity gap — vision exceeds team bandwidth | P2 | Phase gating — no new app until current phase done |
| R5 | Nexus decision pending — wrong choice = wasted quarter | P2 | Force decision before Phase 2 kickoff |

---

## Platform Governance

### SHARED — Platform owns, ALL apps MUST use
- Identity: tec-auth-service + Hub SSO — no custom auth per app
- Cookie names: `tec_access_token`, `tec_csrf`, `tec_user` — LOCKED
- Payment runtime: tec-payment-service contracts (ADR-004 Outbox)
- Pi SDK: PiRuntime.* (PAL) — never `window.Pi.*` directly in new code
- Hub payment URL: `/hub?pay=1&...` ONLY — never `/hub/pay`

### SOVEREIGN — Hub owns independently
- SSO UI and login flow design
- App registry and ecosystem routing
- Hub-specific dashboard and notifications
- Subscription management UI

---

## Release Gate Protocol

Before EVERY commit:
```bash
npm run type-check    # 0 errors — hard block
npm run lint          # 0 errors — hard block
npm test              # all pass
git status            # clean
git fetch origin claude/ecommerce-engineering-review-EuiQO
git rebase origin/claude/ecommerce-engineering-review-EuiQO
```

---

## Operational Protocols

### Incident Response
| Severity | Trigger | Action |
|----------|---------|--------|
| P0 | Payment system down | Revert immediately → hotfix with test |
| P1 | Auth broken / ADR violation | Hotfix branch → fix + test → evidence in PR |
| P2 | UI regression | Next sprint unless user-visible |

### Decision Authority
- New ADR: document first, implement after approval
- Breaking API contract: semver major bump + migration plan
- New app/service: only after current phase complete
- Nexus strategic decision: Yasser only

---

## Platform Context

For full platform architecture, strategic roadmap, and engineering decisions:
- See `TEC_MODELS_PAT.prompt.yml` — full system prompt for AI assistants
- See `TEC_Ecosystem_AI_Key.prompt.yml` — strategic context
- C-47 Kernel Spec — Constitutional layer (platform authority)
- C-41 Engineering Roadmap — Phase 0→3 path to 9.5/10

---

## Dynamic Orchestration

### Ecosystem Role
**Conductor** — SSO authority, payment orchestrator, app registry, and control plane for the TEC federated platform. Hub owns the identity contract that all other apps consume.

### Dependency Map

| Direction | Repos / Services |
|-----------|----------------|
| Upstream | `@yasser172/tec-auth` · `@yasser172/tec-ui` · `@yasser172/tec-sdk` · `tec-core-backend` (Gateway:4000) |
| Downstream | `tec-ecommerce` · `tec-assets` · `tec-commerce` — all consume Hub SSO + `/hub?pay=1` |

### Cross-Repo Workflow Triggers

| Event | Coordinate With | Required Action |
|-------|----------------|----------------|
| SSO / cookie contract change | tec-ecommerce, tec-assets, tec-commerce, tec-auth | Platform-wide — all 4 apps + tec-auth package |
| Hub payment URL change | tec-ecommerce, tec-assets, tec-commerce | `/hub?pay=1` LOCKED (C-76/ADR-007) — ADR required before change |
| `@yasser172/tec-ui` version bump | tec-ecommerce, tec-assets, tec-commerce | Coordinated deploy — ALL 4 apps simultaneously |
| New BFF route pattern | tec-commerce (reference impl) | Validate in tec-commerce first, then propagate |
| tec-core-backend gateway change | tec-sdk | SDK must be updated before frontend routes |

### Release Chain Position

```
tec-core-backend (deploy)
  → tec-sdk (npm publish)
    → tec-auth (npm publish)
      → tec-ui (npm publish)
        → tec-app + tec-ecommerce + tec-assets + tec-commerce  ← HERE (simultaneous)
```

### Orchestration Rules
- Hub sub-pages (KYC, Subscription, Profile, Notifications) = sovereign — no cross-repo coordination needed
- Any change to `/hub?pay=1` URL = P0 — requires ADR + coordination with all 4 apps
- Cookie names (`tec_access_token`, `tec_csrf`, `tec_user`) = LOCKED — coordinate with tec-auth package + all 4 apps before any change

### Knowledge Base Reference
→ `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`)
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Strategic roadmap + risk register: `knowledge-base/C-77___STRATEGIC_ANALYSIS___RISK_ASSESSMENT.md`
→ Operations + SLOs + incidents: `knowledge-base/C-78___PLATFORM_OPERATIONS___RELIABILITY_GOVERNANCE.md`
→ ADR system: `knowledge-base/C-64___ADR_SYSTEM.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`


---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
