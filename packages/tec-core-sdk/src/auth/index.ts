import { TecApiClient } from '../client';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { isPiBrowser } from '../utils/pi-browser';
import type { TecUser, TecAuthResponse } from '../types';

// ─── Incomplete Payment Recovery ─────────────────────────────
/**
 * Pi Network docs require handling incomplete payments on every authenticate() call.
 * If a previous payment was not completed, we must complete or cancel it before proceeding.
 * https://github.com/pi-apps/pi-platform-docs/blob/master/payments.md#incomplete-payments
 */
async function handleIncompletePayment(
  client: TecApiClient,
  payment: { identifier: string; transaction?: { txid?: string } },
): Promise<void> {
  const piPaymentId = payment.identifier;
  if (!piPaymentId) return;
  const txid = payment.transaction?.txid;

  try {
    if (txid) {
      // Payment was submitted on-chain but not completed on our backend — complete it
      await client.post('/api/payments/complete', {
        pi_payment_id: piPaymentId,
        transaction_id: txid,
      });
    } else {
      // Payment was never submitted — cancel it to unblock the user
      await client.post('/api/payments/cancel', {
        pi_payment_id: piPaymentId,
      });
    }
  } catch (err) {
    // Report to monitoring — never block login for incomplete payment errors
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      (window as unknown as { Sentry: { captureException: (e: unknown, ctx: unknown) => void } })
        .Sentry.captureException(err, {
          extra: { piPaymentId, txid, context: 'incomplete_payment_recovery' },
        });
    }
    // Fallback: structured log for aggregators (Datadog/Logtail)
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'incomplete_payment_recovery_failed',
        piPaymentId,
        txid: txid ?? null,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// ─── TecAuthSDK ──────────────────────────────────────────────

export class TecAuthSDK {
  private client: TecApiClient;

  constructor(client: TecApiClient) {
    this.client = client;
  }

  async loginWithPi(): Promise<TecAuthResponse> {
    if (!isPiBrowser()) {
      throw new Error('يجب فتح التطبيق داخل Pi Browser');
    }

    const piAuth = await window.Pi.authenticate(
      ['username', 'payments'],
      // ✅ Pi docs: this callback MUST be implemented — handle incomplete payments
      (payment) => handleIncompletePayment(this.client, payment as { identifier: string; transaction?: { txid?: string } }),
    );

    const result = await this.client.post<TecAuthResponse>('/api/auth/pi-login', {
      accessToken: piAuth.accessToken,
      piUsername: piAuth.user.username,
      piUid: piAuth.user.uid,
    });

    storage.set(STORAGE_KEYS.ACCESS_TOKEN, result.tokens.accessToken);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, result.tokens.refreshToken);
    storage.setJSON(STORAGE_KEYS.USER, result.user);

    return result;
  }

  getStoredUser(): TecUser | null {
    return storage.getJSON<TecUser>(STORAGE_KEYS.USER);
  }

  getAccessToken(): string | null {
    return storage.get(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async getMe(): Promise<TecUser> {
    return this.client.get<TecUser>('/api/auth/me');
  }

  logout(): void {
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    storage.remove(STORAGE_KEYS.USER);
  }

  isAuthenticated(): boolean {
    return !!this.getStoredUser();
  }
}

export { isPiBrowser };
