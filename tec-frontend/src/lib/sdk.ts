/**
 * TEC SDK — BFF Layer entry point
 *
 * يستخدم: @yasser172/tec-sdk (npm published)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️  يُفضَّل استخدامه في API Routes فقط (BFF layer)
 *     للـ Client Components استخدم packages/tec-core-sdk
 *
 * Architecture:
 *   packages/tec-core-sdk  → Frontend SDK (Pi Browser + React hooks)
 *   @yasser172/tec-sdk     → Server SDK (API routes + BFF layer) ← هنا
 */
import { TecSdk } from '@yasser172/tec-sdk';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export const sdk = new TecSdk({ gatewayUrl: GATEWAY_URL });

const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('tec_access_token') : null;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

export const identitySdk = {
  getMe: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/me`, {
      headers: authHeaders(),
    });
    return res.json();
  },
  getProfile: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/profile`, {
      headers: authHeaders(),
    });
    return res.json();
  },
  updateProfile: async (data: {
    displayName?: string;
    bio?: string;
    country?: string;
    language?: string;
    avatarUrl?: string;
  }) => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/profile`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getKyc: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/kyc`, {
      headers: authHeaders(),
    });
    return res.json();
  },
  getRoles: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/roles`, {
      headers: authHeaders(),
    });
    return res.json();
  },
};

export default sdk;
