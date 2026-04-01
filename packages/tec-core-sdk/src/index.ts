/**
 * @tec/core-sdk — Frontend SDK
 *
 * Purpose: Pi Browser authentication, wallet hooks, and payment UI flows.
 * Environment: Browser (Pi Browser) — uses native fetch API, SSR-safe storage.
 *
 * ⚠️  For server-side API calls (Server Actions, API Routes),
 *     use @yasser172/tec-sdk instead.
 *
 * See: ARCHITECTURE.md for full SDK strategy documentation.
 */

// ─── Auth ────────────────────────────────────────────────────
export { TecAuthSDK } from './auth';
export { useTecAuth } from './auth/hooks';
export { TecAuthProvider, TecAuthContext } from './auth/provider';

// ─── Wallet ──────────────────────────────────────────────────
export { TecWalletSDK } from './wallet';
export type {
  WalletListResponse,
  WalletBalanceResponse,
  WalletTransactionsResponse,
  WalletOperationResponse,
  LinkWalletResponse,
  TransferResponse,
} from './wallet';
export { useTecWallet } from './wallet/hooks';

// ─── Payment ─────────────────────────────────────────────────
export { TecPaymentSDK } from './payment';
export { useTecPayment } from './payment/hooks';

// ─── Client ──────────────────────────────────────────────────
/** HTTP client with token refresh deduplication. Browser + SSR safe. */
export { TecApiClient } from './client';

// ─── Utils ───────────────────────────────────────────────────
export { isPiBrowser } from './utils/pi-browser';
export { storage, STORAGE_KEYS } from './utils/storage';

// ─── Types ───────────────────────────────────────────────────
export type * from './types';
