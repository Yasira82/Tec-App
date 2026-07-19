# C-121 — Pioneer Runtime Charter

> **Status:** Draft / Proposed (design authority — no code until adopted)
> **Owner:** Hub (`tec-app`) = Conductor · `tec-identity-service` = Pioneer state authority
> **Scope:** Hub `/pioneers` + `tec-identity-service` (`pioneer` module) + the 24 live domains (event producers) + Legend/Elite/Analytics/Alert/Explorer (owning domains)
> **Constitution:** Governed by C-47 (Kernel Spec). Nothing here may weaken a C-47 invariant.
> **Related:** `_registry.ts` (LIVE domain SSoT) · `docs/PAYMENT_SYSTEM.md` · C-76/ADR-007 (Pi payment) · C-126 Legend · C-127 Elite · C-128 VIP · C-105 Analytics · C-108 Explorer · C-111 Alert

> **TL;DR (عربي):** Pioneer **مش صفحة دعائية** — ده أول **Onboarding Runtime رسمي** للمنصّة.
> المستخدم بيعدّي رحلة: **Login → يكمّل Missions حقيقية في التطبيقات → يوصل Founding Pioneer → يتسجّل في Legend**.
> القاعدة الحاكمة: **الـ Hub بيعرض بس (Conductor)**، والحقيقة بتتملكها الخدمات — Reputation في Legend،
> Recognition في Elite، Statistics في Analytics، Activity Feed في Alert، Discovery في Explorer،
> وحالة الـ Pioneer نفسها في `tec-identity-service`. **ممنوع أي رقم مزيّف** (لو مفيش pioneers اعرض 0)،
> وهوية الـ Pioneer دايمًا من الـ **JWT principal** مش من أي param من العميل. كل تطبيق من الـ24 بيُصدر
> **event واحد** (`pioneer.mission.completed`) والـ identity-service بيسجّله بشكل idempotent وimmutable.

---

## 1. Purpose & Positioning

Pioneer is the **official onboarding runtime** of the TEC ecosystem — the canonical first
journey a Pi user takes after authenticating:

```
User → Pi Login → Pioneer → Hub → Life → Commerce → Assets → Explorer → … rest of the ecosystem
```

It is **not** a marketing page and **not** a standalone game. It is the coordinated path
that turns a curious visitor into an engaged, verified member with a permanent identity
inside TEC (the Founding Pioneer badge in the reputation layer).

**Design intent:** make usage *real* (complete an action in each app), make it *honest*
(every counter is server truth), and make it *composable* (each app contributes via a
single event contract, with zero duplication of reputation/XP/stats in the Hub).

---

## 2. Constitution Alignment (C-47)

| Principle / Invariant | How Pioneer honors it |
|---|---|
| P1 Single Source of Truth | Missions defined once in the registry; Pioneer state owned once by `identity-service`; reputation once by Legend |
| P2 No Rule Duplication | Hub never re-implements XP / badges / reputation / stats — it displays what owning domains expose |
| P3 Strict State Transitions | The Journey is a forward-only state machine, evaluated server-side (§8) |
| P4 Event-Driven Truth | Progress is driven by immutable `pioneer.mission.completed` events, not client claims (§7) |
| P5 Layer Responsibility | SDK = contracts, Gateway = orchestration, Services = execution; Hub = presentation (§3) |
| **P6 Fail Closed** | Identity from verified principal only; unknown/absent principal ⇒ no progress accrues (§5) |
| Invariant #3 Identity → ONE principal | Pioneer identity == verified JWT `sub`, never a client param (§5) |
| Invariant #4 Audit trail | Every mission completion is a recorded event with actor context |
| Invariant #5 Events immutable | A recorded completion is never mutated or deleted |
| Invariant #6 No mutation without actor | Every write carries the ActorContext (the principal + source service) |

---

## 3. Ownership Map (P5) — the most important rule

> The Hub is the **Conductor**, not the **Owner**. If the Hub starts to *own* XP, badges,
> reputation, leaderboards, or activity, you get **two sources of truth**. Forbidden.

| Concern | Owning domain / service | Hub's role |
|---|---|---|
| Pioneer state (missions, journey, founding number) | `tec-identity-service` → `pioneer` module | Read + present |
| Reputation (permanent, evidence-based) | **Legend** (C-126) | Link + display badge |
| Recognition / Status tiers | **Elite** (C-127) / **VIP** (C-128) | Display eligibility |
| Statistics / aggregate counters | **Analytics** (C-105) | Display real numbers |
| Activity Feed | **Alert** (C-111) | Embed feed |
| Discovery / Recommendations | **Explorer** (C-108) | Embed / route |
| Per-app mission completion | The owning app (its BFF) emits the event | Show ✓ |

---

## 4. Domain Model (definitions)

| Term | Definition |
|---|---|
| **Pioneer** | A verified Pi user on the onboarding journey. Identified by the JWT `sub` (§5). |
| **Mission** | A single, real, completable action inside one app (not "open"). One canonical mission per app in v1; richer per-app missions later. Defined in the registry (SSoT). |
| **Event** | An immutable fact that a mission was completed: `pioneer.mission.completed` (§7). |
| **Journey** | The forward-only state machine over completed missions (§8). |
| **Passport** | The Pioneer's identity object: Identity + Journey + History + Founding Number + Certificate (§10). |
| **Founding Pioneer** | One of the first 100 pioneers to complete all live missions. Server-assigned, capped, un-fakeable (§9). |
| **Certificate** | A server-issued, signed proof of completion (§13). |

---

## 5. Identity Resolution (P6 · Invariant #3) — normative

- The Pioneer principal is **always** the verified JWT `sub` extracted at the BFF / gateway.
- **Never** derive the owner from a client-supplied value (`tec_user` cookie, request body,
  or a URL param). Those are hints, not authority.
- Any read of another owner's Passport/quest MUST be authorized to the same principal, or
  require an explicit `AdminActor` (Invariant #6). A `by-owner/{owner}` lookup that is not
  bound to the caller's principal is a **fail-closed defect** (potential IDOR).
- Absent or unverifiable principal ⇒ browsing is allowed, but **no progress accrues** and
  no Passport is returned.

> This section supersedes any current BFF behavior that passes `owner` from the `tec_user`
> cookie. The gateway/guard MUST bind `owner` to the JWT principal.

---

## 6. Mission Catalog (v1 = now, no XP / no leaderboard / no reputation)

v1 missions are intentionally simple: a single real touch per app, tracked as a checkbox.
They need **no** XP, leaderboard, or reputation — but they make usage real and are the
seed the richer missions grow from. The catalog lives in `_registry.ts` (single source of
truth) so the Hub never drifts from what is live.

| App | Owner service | v1 Mission (now) | Richer Mission (Phase C) |
|---|---|---|---|
| tec (Hub) | identity | Log in to the Hub | Complete profile basics |
| nexus | nexus | Open Nexus | View a workflow/route |
| assets | assets | View the assets dashboard | Create first asset |
| commerce | commerce | Browse the marketplace | Complete first checkout |
| fundx | fundx | View a pool charter | (gated — no real contribution v1) |
| nbf | nbf | Open the launch funnel | Start a business template |
| insure | insure | View your risk score | Explore a protection surface |
| ecommerce | ecommerce | Browse a storefront | Place first order |
| estate | estate | View sample portfolio | Save a listing |
| brookfield | brookfield | View institutional portfolio | View a governance record |
| explorer | explorer | Run one search | Save/follow a listing |
| connection | connection | Open Connection | Add first connection |
| zone | zone | Open Zone | Submit first verification evidence |
| life | life | Complete profile / first Goal | Log first activity |
| dx | dx | Open the Developer Portal | Generate an API key |
| nx | nx | Browse the opportunity board | Save first opportunity |
| system | system | Open the Governance Console | Read a policy |
| alert | alert | Open your inbox | Set a first alert rule |
| analytics | analytics | View the ecosystem dashboard | Open a metric |
| vip | vip | View tiers & benefits | (eligibility only) |
| elite | elite | View recognition home | (earned, never bought) |
| titan | titan | Open the enterprise console | Create org profile |
| legend | legend | View your reputation profile | (accrues from activity) |
| epic | epic | Browse the project board | Create first project |

> Count is derived from `LIVE_DOMAINS.length` — never hard-coded. If a domain goes live or
> is delisted, the mission set changes with it automatically.

---

## 7. Event Contract (P4) — the cross-repo interface

Each app (or its BFF) emits **one** event when a mission is genuinely completed. The
`identity-service` `pioneer` module is the sole recorder. This is the contract every one of
the 24 repos implements — it is the Orchestra boundary.

```json
{
  "type": "pioneer.mission.completed",
  "occurredAt": "2026-07-19T16:40:00.000Z",
  "pioneer": { "principal": "<JWT sub — resolved from the verified token>" },
  "app": "commerce",
  "missionId": "commerce.browse_marketplace",
  "source": { "service": "commerce-bff", "requestId": "<x-request-id>" },
  "idempotencyKey": "<principal>:<missionId>"
}
```

**Rules:**
- **Identity** (`pioneer.principal`) is resolved from the verified token, never the body (§5).
- **Idempotent:** `idempotencyKey = principal:missionId`. Re-emitting a completed mission is a
  no-op — one completion per mission per pioneer (no double counting).
- **Immutable** (Invariant #5): a recorded completion is append-only; never edited/removed.
- **Actor context** (Invariant #6): `source.service` + principal are mandatory.
- **Fail closed** (P6): malformed / unauthenticated events are rejected, not "best-effort accepted".
- Events are **facts** (already happened), not commands (P4) — an app emits *after* the action.

---

## 8. Journey State Machine (P3) — the definition of success

The journey is forward-only and evaluated **server-side** from recorded events. Thresholds
reuse the existing tiers, reframed from "apps opened" to "missions completed".

```
VISITOR
  │  (Stage 1) Pi login
  ▼
AUTHENTICATED
  │  (Stage 2) ≥ 5 missions completed
  ▼
EXPLORER
  │  (Stage 3) ≥ 12 missions completed
  ▼
BUILDER
  │  (Stage 4) ALL live missions completed  (currently 24)
  ▼
PIONEER_COMPLETE
  │  if within the first 100 to complete  → assign Founding number (§9)
  ▼
FOUNDING_PIONEER
  │  materialize permanent record in Legend (C-126)
  ▼
LEGEND_LINKED   → then: Advanced Challenges (§14) — the journey continues
```

- Transitions are **monotonic** — a pioneer never regresses (P3).
- Stage thresholds derive from `LIVE_DOMAINS.length` (5 / 12 / all), not literals.
- `PIONEER_COMPLETE` and beyond are **terminal-ish**: completion is permanent (Invariant #7 spirit).

---

## 9. Founding Rules

- **Cap:** `FOUNDING_CAP = 100` (the real "Founding 100" limit).
- **Assignment:** atomic, server-side, on the transition into `PIONEER_COMPLETE`, and only
  if `claimed < 100`. `remaining` MUST never go negative (mirrors Invariant #1's spirit).
- **Server-authoritative & un-fakeable:** completion requires recorded events tied to the
  verified principal — a client cannot fabricate a Founding number.
- **No payment required:** the Founding badge is earned by *completing the journey*, not by a
  Pi payment. (Aligns the UI copy, the comment, and the current service — no payment logic.)
- **Honesty (§14 of C-47 spirit):** public stats show *real* `claimed` / `remaining`. If zero
  pioneers exist, show **0** — never a marketing number.

---

## 10. Passport (identity, not just UI)

The Passport is the Pioneer's identity object inside TEC — a **read model** owned by
`identity-service`, presented (not owned) by the Hub:

```
Pioneer Passport
├── Identity        (pi username, principal, join date)
├── Journey         (current stage, missions completed / total)
├── History         (timeline of completed missions, with timestamps)
├── Founding Number (if FOUNDING_PIONEER — else null)
└── Certificate     (link, if PIONEER_COMPLETE)
```

- Fully derived from recorded events → no separate writable state to drift.
- The Hub renders it; Legend/Elite provide the reputation/recognition surfaces it links to.

---

## 11. XP Rules (defined now, **deferred** to Phase B — owned by Legend)

XP is **not** active in Phase A. It is specified here so the event contract (§7) is
forward-compatible: the `missionId` is enough — the XP weight table lives server-side
(single source), so turning XP on later needs **no** contract change.

| Action | XP | Notes |
|---|---|---|
| Visit | 5 | lowest signal |
| Login | 10 | |
| First action (mission) | 20 | the core signal |
| Pi payment | 50 | must go through payment-service contracts (ADR-007) |
| Invite (referral) | 40 | requires attribution + anti-abuse (§ referral) |

- XP is a **reputation-adjacent** value ⇒ owned by **Legend**, displayed by the Hub.
- XP math never runs in the frontend (P2/P6).

---

## 12. Badge / Achievement Rules

- Achievements (Explorer=5, Builder=12, Trader=first payment, Connector=first connection,
  Founder=all) are **recognition** ⇒ owned by **Legend** (evidence) + **Elite** (tiers).
- The Hub **displays** them; it does not define or grant them (P2).
- The single Pioneer-specific recognition — the **Founding Pioneer badge** — is materialized
  in Legend on `FOUNDING_PIONEER` and surfaced everywhere via the reputation layer.

---

## 13. Certificate Rules

Issued only for a real `PIONEER_COMPLETE` / `FOUNDING_PIONEER` state:

| Field | Source |
|---|---|
| Display name | profile |
| Pi username | verified identity |
| Founding number | identity-service (§9) — may be null for non-founding completers |
| Completion date | timestamp of the completing event |
| Verification hash | server signature over the above |

- Server-generated + signed (un-forgeable). The Hub renders and enables Share (§ share).
- Never issued for an incomplete or unverified journey (P6).

---

## 14. After the 24 — Advanced Challenges (retention)

Completion is not the end. Post-`FOUNDING_PIONEER`, the Hub routes into the ecosystem
(this is exactly the Conductor role — routing, not owning):

| Challenge | Routes to |
|---|---|
| Become a Merchant | Commerce |
| Publish a Project | Epic |
| Verify a Business | Zone / NBF |
| Create an Opportunity | NX |
| Join DX | DX |
| Become a Legend | Legend |

---

## 15. Honesty & Privacy constraints

- **No fabricated data — anywhere.** Feed, stats, leaderboards, community missions, founding
  counters: all must be real service data or show `0`/empty. Credibility with Pi Core Team is
  the whole point.
- **Leaderboards (country / city / university):** TEC does **not** currently collect
  country/city/university, and Pi does not expose them. A geo/edu leaderboard therefore
  requires a **privacy-reviewed, opt-in** data source owned by **Analytics** — it must NOT be
  silently derived from IP. **Deferred** until that source is decided (open question §17).

---

## 16. API / Contract Surface

| Surface | Status | Notes |
|---|---|---|
| `GET /api/bff/pioneer/stats` → `/api/identity/pioneer/stats` | exists | Public, honest counter; must return real 0 when empty |
| `POST /api/bff/pioneer/open` → `/api/identity/pioneer/open` | exists | v1 mission = "open"; principal from token |
| `GET /api/bff/pioneer/me` → `/api/identity/pioneer/me` | exists | **Must** resolve owner from JWT, not `tec_user` (§5) |
| `POST /api/bff/pioneer/mission/complete` | **proposed** | Generic mission event ingress (§7) — supersedes `open` |
| `GET /api/bff/pioneer/passport` | **proposed** | Passport read model (§10) |
| `GET /api/bff/pioneer/certificate` | **proposed** | Certificate issuance/read (§13) |

---

## 17. Phasing → concrete deliverables

**Phase A — Hub frontend, now, Phase-0-safe (polish, not a new subsystem)**
- Simple per-app **missions** (checkbox, no XP) sourced from `_registry.ts` (§6).
- **Passport** read view (Identity · Journey · History · Founding · Certificate placeholder).
- **Honest** zero-safe counters (show 0).
- **Certificate** render + **Share** for a *real* completion only.
- Uses existing `pioneer` endpoints; no backend contract change required.

**Phase B — `tec-identity-service` `pioneer` module**
- `mission/complete` event ingress with idempotency + immutability (§7).
- Server-side **Journey state machine** (§8) + atomic **Founding** assignment (§9).
- **Passport** + **Certificate** read models (§10, §13).
- **Referral** attribution + anti-abuse. XP **defined but off** (§11).

**Phase C — Orchestra (all 24 apps + owning domains)**
- Each app emits `pioneer.mission.completed` for its richer mission (§6, §7).
- Achievements/XP → **Legend/Elite**; Stats/Leaderboards → **Analytics**;
  Feed → **Alert**; Discovery/Recommendations → **Explorer**.

---

## 18. Forbidden (Pioneer-specific)

1. Fabricating any counter (feed, stats, founding, community) — show real data or 0.
2. Resolving the Pioneer identity from a client param (`tec_user`, body, URL).
3. Duplicating XP / badge / reputation / stats logic inside the Hub.
4. Mutating or deleting a recorded mission event.
5. Assigning a Founding number beyond `FOUNDING_CAP`, or letting `remaining` go negative.
6. Issuing a Certificate for an unverified or incomplete journey.
7. Deriving a leaderboard from data the user never consented to share (e.g. IP → country).

---

## 19. Open Questions (need a decision before Phase B/C)

1. **Leaderboard data source & privacy** (§15) — opt-in geo/edu, owned by Analytics? Or drop?
2. **Founding gate** — completion only (this charter's default) vs. a KYC/Pi-payment gate?
3. **Richer missions (§6)** — confirm the "Phase C" mission per app with each domain team.
4. **XP weights (§11)** — final values + whether invite/payment XP ship with Phase B.
5. **Certificate signing** — key custody + verification endpoint owner.

---

> **Note on placement:** the canonical home for C-docs is `yasira82/tec-knowledge-base`.
> This charter is committed to `tec-app/docs/` because it directly governs the Hub's
> `/pioneers` runtime and the cross-repo event contract; it should be mirrored into the
> knowledge base (as C-121) once adopted.
