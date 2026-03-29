import { createU2APayment, PaymentResult } from './pi-payment';
import { getAccessToken } from './pi-auth';

export interface BuyAssetResult {
  success:    boolean;
  listing?:   Record<string, unknown>;
  message?:   string;
  paymentId?: string;
  txid?:      string;
}

export const buyAsset = async (params: {
  listingId: string;
  assetSlug: string;
  price:     number;
  buyerId:   string;
}): Promise<BuyAssetResult> => {
  const { listingId, assetSlug, price, buyerId } = params;

  let paymentResult: PaymentResult;
  try {
    paymentResult = await createU2APayment(
      price,
      `Buy Asset: ${assetSlug}`,
      { listingId, assetSlug, type: 'marketplace_purchase' },
    );
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Payment failed' };
  }

  if (!paymentResult.success || paymentResult.status !== 'completed') {
    return { success: false, message: paymentResult.message ?? 'Payment failed' };
  }

  const token = getAccessToken();
  try {
    const res = await fetch(`/api/marketplace/${listingId}/buy`, {
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
      message:   'Asset purchased successfully! 🎉',
    };
  } catch (err) {
    return {
      success:  false,
      message:  `Payment done but transfer failed. txid: ${paymentResult.txid}`,
      txid:     paymentResult.txid,
    };
  }
};
