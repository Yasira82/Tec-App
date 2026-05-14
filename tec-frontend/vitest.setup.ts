import { vi } from 'vitest';

// Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken:     vi.fn().mockResolvedValue(null),
  isSupported:  vi.fn().mockResolvedValue(false),
}));

// ✅ SDK mock — يمنع BaseClient من الـ initialize بدون NEXT_PUBLIC_API_GATEWAY_URL
vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken:  vi.fn(),
    setAuthToken:    vi.fn(),
    payment: {
      resolveIncomplete: vi.fn(),
      createPayment:     vi.fn(),
      approvePayment:    vi.fn(),
      completePayment:   vi.fn(),
    },
    auth:          { login: vi.fn() },
    wallet:        { getBalance: vi.fn() },
    notifications: { getUnread: vi.fn() },
    assets:        { list: vi.fn() },
    health:        { check: vi.fn() },
  },
}));

import '@testing-library/jest-dom';
