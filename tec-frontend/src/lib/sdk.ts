// tec-frontend/src/lib/sdk.ts

import { TecSdk } from '@yasser172/tec-sdk';

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  'https://api-gateway-production-6a68.up.railway.app';

export const sdk = new TecSdk({ gatewayUrl: GATEWAY_URL });

// ─── helpers ─────────────────────────────────────────────
const getToken = () =>
  typeof window !== 'undefined'
    ? localStorage.getItem('tec_access_token')
    : null;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ─── Identity Service ─────────────────────────────────────
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
