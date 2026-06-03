# TEC App — Claude Code Instructions

## What This Repo Is

TEC Hub — the Control Plane for the TEC Federated Platform Ecosystem.
Handles: identity authority, SSO, payment orchestration, app routing,
subscriptions, and ecosystem coordination.

**Current Phase: Platform Hardening** — fix P1 violations before any new features.

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

## Active P1 Violations — Fix These First

| ID | Severity | Description | Est. Fix |
|----|----------|-------------|----------|
| NEW-A | SECURITY | Railway URLs in client bundle | 1 day |
| NEW-B | BLOCKING | payment-service INTERNAL_SECRET missing | 30 min |
| NEW-D | CRITICAL | tec-auth-service: zero tests | 2 days |

**No new features until P1 violations are closed.**

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
    app/                  # Next.js App Router pages
      api/                # BFF routes (server-side only)
        bff/              # Backend-for-Frontend proxies
    components/           # React components
    lib/                  # Client utilities
    lib-server/           # Server-only utilities
packages/
  tec-core-sdk/           # Browser Pi SDK hooks
  tec-ui/                 # Shared design system
shared/                   # Shared types and contracts
```

---

## What NOT To Do

- Do NOT add NEXT_PUBLIC_* env vars for internal service URLs
- Do NOT call window.Pi directly — use PiRuntime.* wrapper
- Do NOT implement custom auth — use Hub SSO
- Do NOT implement custom payment logic — use tec-payment-service contracts
- Do NOT add new apps or major features during Platform Hardening Phase
- Do NOT skip isHubNavigation() check before Pi payments

---

## Pi SDK Known Behaviors

- ADR-007: Foreign session when navigating from hub
- window.__TEC_PI_READY: true after Pi.init() completes
- window.__TEC_PI_FOREIGN_SESSION: true when Pi SDK already initialized by hub
- Pi.init() throws "already initialized" in foreign session — handle gracefully
- Pi.authenticate() throws "not initialized" in foreign session — DO NOT call

---

## Commit Convention

```
feat(scope):   new feature
fix(scope):    bug fix
docs(scope):   documentation
style(scope):  formatting only
refactor:      no behavior change
test(scope):   tests only
chore(scope):  build/config
```

## Platform Context

For full platform architecture, strategic roadmap, and engineering decisions:
- See `TEC_MODELS_PAT.prompt.yml` — full system prompt for AI assistants
- See `TEC_Ecosystem_AI_Key.prompt.yml` — strategic context
- See `ARCHITECTURE.md` — two-SDK architecture
- ADRs are tracked in session context and `TEC_MODELS_PAT.prompt.yml`
