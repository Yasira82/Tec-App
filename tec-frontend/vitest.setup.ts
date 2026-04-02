import { vi } from 'vitest';

// Firebase Messaging requires Service Workers which are not available in happy-dom.
// Mock both packages globally so no test environment triggers the unsupported-browser error.
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken:     vi.fn().mockResolvedValue(null),
  isSupported:  vi.fn().mockResolvedValue(false),
}));

import '@testing-library/jest-dom';
