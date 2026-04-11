/**
 * TEC SDK — BFF Layer entry point
 *
 * يستخدم: @yasser172/tec-sdk (npm published)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️  يُفضَّل استخدامه في API Routes فقط (BFF layer)
 *
 * Architecture:
 *   @yasser172/tec-sdk → Server SDK (API routes + BFF layer) ← هنا
 */
import { TecSdk }      from '@yasser172/tec-sdk';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export const sdk = new TecSdk({ gatewayUrl: GATEWAY_URL });

// ✅ P1-2: من الـ cookie مش localStorage
const getToken = (): string | null => getAccessToken();

const getUserId = (): string | null => {
  const user = getStoredUser() as { id?: string; uid?: string } | null;
  return user?.id ?? user?.uid ?? null;
};

const authHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

export const identitySdk = {
  getMe: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/me`, {
      credentials: 'include',
      headers:     authHeaders(),
    });
    return res.json();
  },

  getProfile: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/profile`, {
      credentials: 'include',
      headers:     authHeaders(),
    });
    return res.json();
  },

  updateProfile: async (data: {
    displayName?: string;
    bio?:         string;
    country?:     string;
    language?:    string;
    avatarUrl?:   string;
  }) => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/profile`, {
      method:      'PATCH',
      credentials: 'include',
      headers:     authHeaders(),
      body:        JSON.stringify(data),
    });
    return res.json();
  },

  getKyc: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/kyc`, {
      credentials: 'include',
      headers:     authHeaders(),
    });
    return res.json();
  },

  getRoles: async () => {
    const res = await fetch(`${GATEWAY_URL}/api/identity/roles`, {
      credentials: 'include',
      headers:     authHeaders(),
    });
    return res.json();
  },
};

export { getToken, getUserId };
export default sdk;
