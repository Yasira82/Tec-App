// tec-frontend/src/types/pi.types.ts

export interface PiUser {
  uid: string;
  username: string;
}

export interface PiAuthResult {
  accessToken: string;
  user: PiUser;
}

export interface TecUser {
  id: string;
  piId: string;
  piUsername: string;
  role: string;
  subscriptionPlan: string | null;
  createdAt: string;
}

export interface TecAuthResponse {
  success: boolean;
  isNewUser: boolean;
  user: TecUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
}

// ✅ أضفنا 'created' و 'failed'
export type PaymentStatus =
  | 'idle'
  | 'created'      // ← جديد
  | 'pending'
  | 'approved'
  | 'completing'
  | 'completed'
  | 'cancelled'
  | 'failed'       // ← جديد
  | 'error';

export interface PaymentState {
  status: PaymentStatus;
  paymentId: string | null;
  txid: string | null;
  error: string | null;
  amount: number;
