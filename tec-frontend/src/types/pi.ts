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
}
