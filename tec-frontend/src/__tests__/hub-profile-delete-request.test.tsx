/**
 * "Delete account" in /hub/profile must do what it says it does.
 *
 * Until 16 Nov 2026 the button asked "Are you sure? This cannot be undone." and then
 * ran `// TODO: DELETE /api/auth/profile` — nothing. The person was told their account
 * was gone while it stayed. There is no self-service delete endpoint; erasure is done by
 * an admin (/hub/admin/erasure) on a request. So the button IS that request: an email to
 * the contact address, naming the account, and no confirm dialog that promises a deletion
 * nothing performs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@/test-utils/render-with-locale';
import { CONTACT_EMAIL } from '@/lib/contact';

const mockUsePiAuth = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname:     () => '/hub/profile',
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));
vi.mock('@/lib-client/hooks/useKyc', () => ({ useKyc: () => ({ kyc: null, isLoading: false }) }));
vi.mock('@/components/hub', () => ({
  HubSubShell: ({ children, title }: any) => <div><h1>{title}</h1>{children}</div>,
}));
vi.mock('@/components/dashboard', () => ({
  DashboardCard: ({ children, title }: any) => <div><h2>{title}</h2>{children}</div>,
}));

import HubProfilePage from '@/app/hub/profile/page';

beforeEach(() => {
  mockUsePiAuth.mockReturnValue({
    user: { id: 'u-1', piUsername: 'alice', role: 'user', createdAt: '2024-01-01T00:00:00Z' },
    isAuthenticated: true, isLoading: false, logout: vi.fn(),
  });
});

describe('/hub/profile — delete account', () => {
  it('is an email request naming the account, to the real contact address', () => {
    render(<HubProfilePage />);
    const link = screen.getByRole('link', { name: 'Request deletion' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain('@alice');
  });

  it('never claims to delete anything itself — no confirm dialog', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<HubProfilePage />);
    screen.getByRole('link', { name: 'Request deletion' }).click();
    expect(confirm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('contact address', () => {
  it('is a deliverable address — not a .pi name, which no mail server answers', () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
    expect(CONTACT_EMAIL.endsWith('.pi')).toBe(false);
  });
});
