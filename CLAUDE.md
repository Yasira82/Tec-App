> ⚡ **SESSION START — أول حاجة:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` من `yasira82/tec-knowledge-base` (branch: `main`) — ده مصدر الحقيقة للوضع الحالي. لا تعتمد على الذاكرة أو الملخص.

---

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

---

## P1 Violations Status

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| NEW-A | SECURITY | Railway URLs in client bundle | ✅ CLOSED |
| NEW-B | BLOCKING | payment-service INTERNAL_SECRET missing | ✅ CLOSED — set on Railway |
| NEW-D | CRITICAL | tec-auth-service: zero tests | ✅ CLOSED — 95% coverage |
| NEW-J | FEATURE | Ecommerce Cart Phase 2+3 | ✅ CLOSED |
| NEW-K | HUB | Hub sub-pages missing | ✅ CLOSED |
| NEW-L | BUG | Wallet page shows zero balance | ✅ CLOSED |

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
      hub/
        layout.tsx               # Imports tec-design-tokens.css for all hub sub-pages
        page.tsx                 # Hub home — wallet card, apps grid, payment modal
        kyc/page.tsx             # /hub/kyc — KYC verification flow
        notifications/page.tsx   # /hub/notifications — notification center
        subscription/page.tsx    # /hub/subscription — FREE/PRO/ENTERPRISE plans
        profile/page.tsx         # /hub/profile — account info + quick actions
        pay/page.tsx             # /hub/pay — redirects → /hub?pay=1
      api/
        bff/
          metrics/
          wallet/balance/
          payment/
          payments/
          notifications/
    lib-client/
      pi/
        PiRuntime.ts             # Pi Abstraction Layer (PAL)
        PiCircuitBreaker.ts      # Circuit breaker: 3 failures → OPEN 60s
    styles/
      tec-design-tokens.css
packages/
  tec-core-sdk/
  tec-ui/
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
- Do NOT fetch data from `/api/wallet/*` or `/api/payments/*` in client hooks — use `/api/bff/*`
- Do NOT write payment tests without mocking `/api/.../payment/create` fetch first

---

## Pi App Identity

| App | Pi App ID | Domain |
|-----|-----------|--------|
| Hub | `tec-app-923b947851f9dfe1` | `https://hub.tecosystem.app` |

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
HUB (tec-app) — Control Plane / Conductor
  ├── @yasser172/tec-auth    ← Auth package
  ├── tec-core-backend       ← All backend microservices
  ├── @yasser172/tec-sdk     ← Server BFF SDK
  ├── @yasser172/tec-ui      ← Shared design system
  ├── tec-ecommerce
  ├── tec-assets
  └── tec-commerce
```

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Pi SDK update breaks all payments | P0 | PAL — single fix point |
| R2 | Auth-service silent regression | P1 | ≥ 60% coverage |
| R3 | Infrastructure URLs in client bundle | P1 | NEW-A fix |

---

## Release Gate Protocol

Before EVERY commit:
```bash
npm run type-check    # 0 errors — hard block
npm run lint          # 0 errors — hard block
npm test              # all pass
git status            # clean
```

---

## Platform Governance

### SHARED
- Identity: tec-auth-service + Hub SSO
- Cookie names: `tec_access_token`, `tec_csrf`, `tec_user` — LOCKED
- Payment runtime: tec-payment-service contracts (ADR-004 Outbox)
- Pi SDK: PiRuntime.* (PAL)
- Hub payment URL: `/hub?pay=1&...` ONLY

### SOVEREIGN
- SSO UI and login flow design
- App registry and ecosystem routing
- Hub-specific dashboard and notifications
- Subscription management UI

---

## Knowledge Base Reference

→ `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`)
→ **Current State: `knowledge-base/C-02___CURRENT_STATE_.md`** — اقرأه أول كل session
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Strategic roadmap + risk register: `knowledge-base/C-77___STRATEGIC_ANALYSIS___RISK_ASSESSMENT.md`
→ Operations + SLOs + incidents: `knowledge-base/C-78___PLATFORM_OPERATIONS___RELIABILITY_GOVERNANCE.md`
→ ADR system: `knowledge-base/C-64___ADR_SYSTEM.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`

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
