import { createU2APayment, PaymentResult } from './pi-payment';
import { getAccessToken } from './pi-auth';

export interface BuyAssetResult {
  success:   boolean;
  listing?:  Record<string, unknown>;
  message?:  string;
  paymentId?: string;
  txid?:     string;
}

export const buyAsset = async (params: {
  listingId: string;
  assetSlug: string;
  price:     number;
  buyerId:   string;
}): Promise<BuyAssetResult> => {
  const { listingId, assetSlug, price, buyerId } = params;

  // ── Step 1: Pi Payment ──────────────────────────────────────
  let paymentResult: PaymentResult;
  try {
    paymentResult = await createU2APayment(
      price,
      `Buy Asset: ${assetSlug}`,
      { listingId, assetSlug, type: 'marketplace_purchase' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment failed';
    return { success: false, message: msg };
  }

  if (!paymentResult.success || paymentResult.status !== 'completed') {
    if (paymentResult.status === 'cancelled') {
      return { success: false, message: 'Payment cancelled' };
    }
    return { success: false, message: paymentResult.message ?? 'Payment failed' };
  }

  // ── Step 2: Transfer ownership via API ─────────────────────
  const token = getAccessToken();
  try {
    const res = await fetch(`/api/marketplace?action=${listingId}/buy`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        buyerId:   buyerId,
        paymentId: paymentResult.txid ?? paymentResult.paymentId,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Transfer failed');

    return {
      success:   true,
      listing:   data.data?.listing,
      paymentId: paymentResult.paymentId,
      txid:      paymentResult.txid,
      message:   `Asset purchased successfully! 🎉`,
    };
  } catch (err) {
    // Payment succeeded but transfer failed — critical to log
    console.error('[buyAsset] Transfer failed after payment:', err);
    return {
      success:  false,
      message:  `Payment completed but transfer failed. Contact support with txid: ${paymentResult.txid}`,
      txid:     paymentResult.txid,
      paymentId: paymentResult.paymentId,
    };
  }
};
