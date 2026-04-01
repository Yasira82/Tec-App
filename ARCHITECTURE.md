# TEC Ecosystem — SDK Architecture

## SDK Strategy: Two-Layer Design

TEC Ecosystem uses two complementary SDKs with distinct responsibilities.

---

## Layer 1 — `packages/tec-core-sdk` (Frontend SDK)

**Purpose:** Pi Network Browser integration + Frontend state management

**Used in:** `tec-frontend/` — Client Components, Hooks, Providers

**Technology:** `fetch` API (browser-native), SSR-safe storage

**Responsibilities:**
- Pi Network Authentication (`TecAuthSDK`)
- Wallet UI operations (`TecWalletSDK`)
- Payment flow UI (`TecPaymentSDK`)
- Token refresh deduplication (`TecApiClient`)
- React hooks + Context providers

**Import:**
```typescript
import { TecAuthSDK, useTecAuth, TecAuthProvider } from '@tec/core-sdk';
import { TecWalletSDK, useTecWallet } from '@tec/core-sdk';
import { TecPaymentSDK, useTecPayment } from '@tec/core-sdk';
Layer 2 — @yasser172/tec-sdk (npm) (Server SDK)
Purpose: Backend service communication + Response validation
Used in: tec-frontend/src/app/api/ — Server Actions, API Routes (BFF Layer)
Technology: axios + zod schemas
Responsibilities:
Typed API calls to all 12 microservices
Response validation with Zod schemas
Retry logic with exponential backoff
Server-side token injection
Import:
import { TecSdk } from '@yasser172/tec-sdk';

const tec = new TecSdk({ gatewayUrl: process.env.API_GATEWAY_URL! });
const payment = await tec.payment.createPayment(userId, amount);
Decision Matrix — Which SDK to Use?
Scenario
Use
Pi Network login button
TecAuthSDK (core-sdk)
React wallet balance hook
useTecWallet (core-sdk)
Server Action: create payment
TecSdk.payment (npm sdk)
API Route: fetch orders
TecSdk.commerce (npm sdk)
Client Component: show notifications
useTecWallet pattern (core-sdk)
Middleware: verify JWT
jose directly (neither)
Why Two SDKs?
Browser constraints — Pi Network SDK only works in Pi Browser
Bundle size — axios + zod should not be in client bundles
SSR safety — Server SDK runs in Node.js, Frontend SDK is browser-safe
Separation of concerns — UI state vs API communication
Future: SDK Convergence Plan (v2.0)
When moving to a full server-component architecture:
packages/tec-core-sdk → UI components + Pi Browser only
@yasser172/tec-sdk → all API communication (client + server)
Shared types package: packages/tec-types
---
