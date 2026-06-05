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

---

## P1 Violations Status

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| NEW-A | SECURITY | Railway URLs in client bundle | ✅ CLOSED — hardcoded URLs removed, BFF proxy added |
| NEW-B | BLOCKING | payment-service INTERNAL_SECRET missing | ⚠️ OPS ONLY — set `INTERNAL_SECRET` on Railway for all 4 services |
| NEW-D | CRITICAL | tec-auth-service: zero tests | ✅ CLOSED — 95% stmt / 92.98% branch / 100% lines coverage |
| NEW-J | FEATURE | Ecommerce Cart Phase 2+3 | ✅ CLOSED — useCart + CartDrawer + ShopHeader badge |

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
      api/bff/
        metrics/        # GET /api/bff/metrics — 24h payment observability
    lib-client/
      pi/
        PiRuntime.ts      # Pi Abstraction Layer (PAL) — never call window.Pi directly
        PiCircuitBreaker.ts # Circuit breaker: 3 failures → OPEN 60s → HALF_OPEN
packages/
  tec-core-sdk/           # Browser Pi SDK hooks
  tec-ui/                 # Shared design system
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
□ KYC UI — /hub/kyc
□ Subscription UI — /hub/subscription (FREE/PRO/ENTERPRISE)
□ Notifications Center — /hub/notifications
□ Profile page completion
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
  □ NEW-A: NEXT_PUBLIC_ fix across all BFF routes
  □ NEW-B: INTERNAL_SECRET required startup guard
  □ Zero P1 violations
  □ External audit ≥ 9.5

Infrastructure:
  ✅ 12 Railway services Active
  ✅ DECIMAL(20,8) + balance >= 0
  ✅ Policy CI active
  □ PI_SANDBOX=false verified on ALL production services
  □ Pi Network developer portal submission ready

Content:
  ✅ Commerce + Assets + Ecommerce shipped
  □ Hub: KYC + Subscription + Notifications
  □ Tests coverage ≥ 60% (all repos)
  □ tec-ui v1.2.0 published with shared payment components

Final:
  □ External audit
  □ Fix any new audit findings
  □ Submit to Pi Network
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
