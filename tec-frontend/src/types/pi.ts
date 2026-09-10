export type PaymentStatus = "pending" | "success" | "failed" | "cancelled";

export interface PiPaymentData {
  paymentId: string;
  txid: string;
}

export interface PiPaymentError {
  message: string;
  code?: number;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPaymentData) => void;
  /**
   * Pi calls this INSTEAD of opening the wallet when the user still has an
   * unfinished payment on this app. Its absence from this type is why no app in
   * the fleet supplied it: TypeScript rejected the property, so the only way to
   * add the handler was to widen the contract first — and nobody did.
   *
   * A missing handler is silent. The flow stops at "Confirm in Pi Wallet…" and
   * waits forever, so one abandoned payment poisons every payment after it.
   *
   * Optional, because the apps have not adopted it yet and a required field
   * would break their builds rather than fix anything.
   */
  onIncompletePaymentFound?: (payment: { identifier?: string }) => void;
}
