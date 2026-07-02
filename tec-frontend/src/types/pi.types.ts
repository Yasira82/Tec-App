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
  /** One-time signed token: lets the client finish login via a top-level
   *  navigation to /api/auth/sso-callback, which sets the session cookies on a
   *  navigation response — the only path Pi Browser persists reliably. */
  ssoToken?: string;
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

export type PaymentStatus =
  | 'idle'
  | 'created'
  | 'pending'
  | 'approved'
  | 'completing'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'error';

export interface PaymentState {
  status: PaymentStatus;
  paymentId: string | null;
  txid: string | null;
  error: string | null;
  amount: number;
}
