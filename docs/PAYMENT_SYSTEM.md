# TEC Payment System — How It Works, What, and Why

> **Status:** Current State (post payment-unification, ADR-009)
> **Owner:** Hub (tec-app) = payment orchestrator · payment-service = execution
> **Scope:** All 4 frontend apps (Hub, Ecommerce, Assets, Commerce) + API Gateway + payment-service

> **TL;DR (عربي):** الدفع بيشتغل بنظامين: **Mode 2** (التطبيق لوحده جوّه Pi Browser)
> و **Mode 1** (التطبيق بيحوّل للـ Hub modal). الاتنين بيمشوا على **عقد واحد**:
> `amount` رقم، المسار `/api/payment/*`، الهيدر `x-internal-key`. كل دفعة بتعدّي بـ
> 4 خطوات: **create → Pi.createPayment → approve → complete**. أي توكن منتهي بيتعمله
> refresh تلقائي عشان العملية ماتتعلّقش. الفشل اللي حصل قبل كده كان بسبب انحرافات في
> العقد + بوابة CSRF، واتقفلوا بـ ADR-009 + CI guard.

---

## 1. The big picture

```
┌── Client (browser / Pi Browser) ───────────────────────────────┐
│  App page → pi-payment client → window.Pi.createPayment(...)    │
│                         │                                       │
│                         ▼  (same-origin fetch, cookies)         │
│  /api/(bff/)payment/{create,approve,complete,resolve,cancel}    │  ← BFF (Next.js route)
└─────────────────────────┬───────────────────────────────────────┘
                          ▼  Authorization: Bearer + x-internal-key
                  API Gateway (tec-api-gateway:4000)
                   rewrites ^/api/payment → /payments
                          ▼
                  tec-payment-service (4002)
                   state machine + Pi Network API + audit
                          ▼
                     Pi Network
```

**One rule that explains everything:** the frontend never talks to Pi Network's
*server* API or the payment DB directly. It (a) drives the **browser** Pi SDK to
get user approval, and (b) calls its **own BFF routes**, which proxy to the
gateway → payment-service, which is the single owner of payment state.

---

## 2. The two payment modes (ADR-002 Dual-Mode, ADR-007 Foreign Session)

A user can start a payment from two places, and Pi Browser behaves differently:

### Mode 2 — Standalone (user is directly on the app)
`ecommerce.tecosystem.app` (or assets/commerce) in Pi Browser, **not** arriving
from the Hub. The Pi SDK session belongs to that app → `Pi.createPayment` works.

```
buy handler → createPaymentRecord() → window.Pi.createPayment()
            → onApproval  → /api/bff/payment/approve
            → onComplete  → /api/bff/payment/complete
```

### Mode 1 — Via Hub (user arrived FROM hub.tecosystem.app)
**ADR-007:** when navigating from the Hub, the Pi SDK is in a *foreign session* —
`Pi.authenticate()` / `createPayment` throw `payment_not_found`. So the app must
**not** attempt a Pi call. Instead it redirects to the Hub, which owns the Pi
session for that context:

```
buy handler → isHubNavigation()===true → redirect to
   https://hub.tecosystem.app/hub?pay=1&amount=..&memo=..&product_id=..&return_url=..&source=..
Hub reads the params → creates the record → opens its own PaymentModal
   → window.Pi.createPayment() (Hub session) → approve → complete
   → redirects back to return_url?payment_status=success&txid=..
```

**The guard that selects the mode (must be in every buy handler):**
```ts
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app');

if (isHubNavigation() || !window.Pi || !piReady) {
  redirectToHubPayment(...);   // Mode 1
  return;
}
// Mode 2
```
> Removing this guard = Mode-1 payments fail with `payment_not_found`. It is a
> locked invariant (Risk R1/R2 in every app).

---

## 3. The payment lifecycle (the 4 calls)

Every successful payment is exactly this sequence. The internal `payment_id`
(our DB id) is created **before** Pi is invoked — Pi is never called without an
owning record (C-76).

| # | Step | Who calls | Endpoint | Body | Purpose |
|---|------|-----------|----------|------|---------|
| 1 | **create** | client | `POST /api/(bff/)payment/create` | `{ amount:number, currency:'PI', payment_method:'pi', metadata }` | create DB record `status=created`, returns `payment_id` |
| 2 | **Pi.createPayment** | client (browser SDK) | — | `{ amount, memo, metadata }` | user approves in Pi wallet |
| 3 | **approve** | client `onReadyForServerApproval` | `POST /api/(bff/)payment/approve` | `{ payment_id, pi_payment_id }` | server approves with Pi → `status=approved` |
| 4 | **complete** | client `onReadyForServerCompletion` | `POST /api/(bff/)payment/complete` | `{ payment_id, transaction_id }` | server verifies txid with Pi → `status=completed` |

**Recovery paths:**
- **resolve-incomplete** — `onIncompletePaymentFound` (a payment the user started
  earlier but never finished). `POST /api/payment/resolve-incomplete { pi_payment_id }`
  → server completes it (if a txid exists) or cancels it. This is what clears a
  "Pending Payment Found" state.
- **cancel** — explicitly cancel a pending payment.

State machine (payment-service, **terminal states are final** — C-47 Inv. 7):
```
created → approved → completed
   └──────────────→ cancelled / failed   (terminal — no transitions out)
```

---

## 4. The canonical contract (ADR-009 — the part that kept breaking)

Defined **once** in `@yasser172/tec-sdk` `src/contracts/payment.ts`; every BFF
route conforms to it. Three values are non-negotiable because the gateway /
payment-service enforce them:

| Field | Value | Why |
|-------|-------|-----|
| `amount` | **number** (`z.coerce.number()`) | payment-service stores a DECIMAL; a string fails validation. Coerce from string **once** at the BFF boundary, number everywhere below. |
| gateway path | **`/api/payment/*`** (singular) | gateway rewrites `^/api/payment → /payments`. Plural `/api/v1/payments` or a bare `/payments` mis-route / 404. |
| internal header | **`x-internal-key`** + `INTERNAL_SECRET` | the ONLY internal-auth header the gateway validates. `x-service-secret` is ignored → 401/500. |

> **Display amounts** (wallet balance, metrics) are returned as **strings** for
> DECIMAL precision — that is correct. The mistake was applying "amount as string"
> to the **payment create body**. Display = string, payment input = number.

---

## 5. Auth & CSRF (the part that caused the 403s)

### Session
SSO via the Hub sets host-only, `httpOnly:false`, `sameSite:none` cookies:
`tec_access_token`, `tec_refresh_token` (httpOnly), `tec_user`, `tec_csrf`.
Every payment BFF call is **same-origin** (the app calls its own `/api/...`).

### CSRF (post-fix)
A state-changing request is accepted if **EITHER**:
1. **double-submit** — `x-csrf-token` header === `tec_csrf` cookie, **OR**
2. **first-party origin** — `Origin` host === `Host`, or ends with `.tecosystem.app`.

**Why both:** the pure double-submit cookie is unreliable across SSO domains and
**inside Pi Browser, which drops `sameSite=None` cookies** → the client sends an
empty `x-csrf-token` → strict double-submit 403'd every legit payment. Verifying
the `Origin` is an OWASP-recommended, cookie-independent CSRF defense; a cross-site
attacker cannot forge the browser-set `Origin`, so protection is preserved.

### Token expiry (the "stuck pending payment" cause)
All payment mutations go through one helper, `lib/server/payment-gateway.ts`
`gatewayPost()`, which **refreshes the access token once on 401 and retries**
(via `tec_refresh_token`). Before this, `resolve-incomplete`/`cancel` failed with
`TOKEN_EXPIRED` and the pending payment stayed stuck, blocking new payments.

---

## 6. File map

```
Client (per app):
  src/lib/pi-payment.ts            createPaymentRecord() + createU2APayment()  (canonical)
  buy handlers (page.tsx, CartDrawer, MintAsNftButton, ...)  isHubNavigation() guard

Hub extras:
  src/app/hub/page.tsx             reads /hub?pay=1 params (Mode 1 entry)
  src/app/hub/components/PaymentModal.tsx   Hub-session Pi payment UI
  src/lib-client/pi/pi-payment.ts  createU2APayment (Hub)

BFF routes (Next.js):
  src/app/api/(bff/)payment/create|approve|complete|resolve|cancel|resolve-incomplete
  src/lib/server/payment-gateway.ts   gatewayPost() — token refresh + x-internal-key  (SINGLE SOURCE)

Shared contract:
  @yasser172/tec-sdk  src/contracts/payment.ts   schemas + paths + header

Middleware (per app):
  src/middleware.ts                CSRF gate (double-submit OR first-party origin)

Backend:
  tec-api-gateway      service-registry.ts (path rewrite), proxy.service.ts (x-internal-key inject)
  tec-payment-service  payment.controller.ts (state machine), pi-api.ts (Pi Network + circuit breaker)
```

---

## 7. Why payments broke before (the lessons baked into this doc)

| Symptom | Root cause (a "hardening" change) | Fix |
|---------|-----------------------------------|-----|
| Hub modal payment fails, modal flashes | create body sent `amount` as **string** | `amount` number (ADR-009) |
| All apps 403 on payment POST | audit added payment routes to the **CSRF double-submit** gate; cookie unavailable in Pi Browser | accept first-party Origin |
| Assets mint recorded 1π not real price | mint used a divergent client → legacy approve hardcoded `amount:1` | unified onto canonical client |
| `x-service-secret` / `/payments` 404 | a parallel BFF stack with a divergent header + path | deleted; canonical `/api/payment/*` + `x-internal-key` |
| "Pending Payment Found" never clears | resolve/cancel didn't refresh an expired token → `TOKEN_EXPIRED` | `gatewayPost()` refreshes + retries |

**Pattern:** every outage came from a payment file **drifting from the one
contract**. The defenses below stop that class of bug, not just the instances.

---

## 8. How to NOT break payments during tests / updates (the radical prevention)

1. **One contract, one place.** Payment request shapes live in
   `@yasser172/tec-sdk` `contracts/payment.ts`. Do not re-declare Zod for payment
   bodies inside an app. `amount` is always a **number** at the BFF boundary.
2. **One gateway helper.** All payment BFF routes use
   `lib/server/payment-gateway.ts` `gatewayPost()` (token refresh + `x-internal-key`).
   Don't hand-roll `fetch(GATEWAY...)` in a payment route.
3. **CI policy guard** (`.github/workflows/ci.yml`, every app) fails the build on:
   - `x-service-secret` / `SERVICE_SECRET`
   - `z.string()` for `amount` in a payment route
4. **Never** put payment routes behind a cookie-only CSRF gate — keep the
   first-party-Origin acceptance.
5. **Don't change** `/hub?pay=1`, the cookie names, or the `isHubNavigation()`
   guard without an ADR (locked: C-76 / ADR-007).
6. Before merging a payment change, run per repo: `npm run typecheck && npx vitest`
   and confirm the CI `payment-policy` job is green.

### Manual recovery for a stuck pending payment
1. Log out → log in (fresh token).
2. Open the app → the `onIncompletePaymentFound` resolver now auto-clears it
   (token auto-refreshes). If not, use the Hub `/pi-test` → **Cancel Pending**.
3. Long-term: a payment-service reconciliation job should sweep stale
   `created`/`approved` payments hourly (C-47 "orphan payment → reconciliation
   cron 60min"; ADR-004 Outbox). Tracked as the next backend hardening item.

---

## 9. Related governance

- **ADR-002** Dual-Mode Payment · **ADR-007 / C-76** Pi Foreign Session & ownership
- **ADR-004** Outbox (payment-service event integrity)
- **ADR-009** Unified Payment Contract (this document's contract section)
- **C-12** Dual-Mode Payment · **C-47** Kernel Spec (invariants, terminal states)
- **C-71** Financial Integrity Spec
