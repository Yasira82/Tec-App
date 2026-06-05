import { TecSdk }                        from '@yasser172/tec-sdk';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

export const sdk = new TecSdk({
  gatewayUrl: process.env.API_GATEWAY_URL ?? 'http://localhost:4000',
});

// ✅ من الـ cookie مش localStorage
const getToken = (): string | null => getAccessToken();

const getUserId = (): string | null => {
  const user = getStoredUser() as { id?: string; uid?: string } | null;
  return user?.id ?? user?.uid ?? null;
};

// ✅ VM-004: BFF calls عبر /api/* — مش gateway مباشرة
export const identitySdk = {
  getMe: async () => {
    const res = await fetch('/api/identity/me', { credentials: 'include' });
    return res.json();
  },

  getProfile: async () => {
    const res = await fetch('/api/identity/profile', { credentials: 'include' });
    return res.json();
  },

  updateProfile: async (data: {
    displayName?: string;
    bio?:         string;
    country?:     string;
    language?:    string;
    avatarUrl?:   string;
  }) => {
    const res = await fetch('/api/identity/profile', {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(data),
    });
    return res.json();
  },

  getKyc: async () => {
    const res = await fetch('/api/identity/kyc', { credentials: 'include' });
    return res.json();
  },

  getRoles: async () => {
    const res = await fetch('/api/identity/roles', { credentials: 'include' });
    return res.json();
  },
};

export { getToken, getUserId };
export default sdk;
