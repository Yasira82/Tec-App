/**
 * Coverage for remaining low/zero-coverage utility files:
 *   src/lib/hub/utils.ts                        (haptic)
 *   src/lib-client/pi/marketplace-payment.ts    (buyAsset)
 *   src/lib/i18n/index.tsx                      (LocaleProvider, useTranslation)
 *   src/lib-client/hooks/useKyc.ts              (uploadDocs, submit, reset)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, act, screen, waitFor, renderHook } from '@testing-library/react';

// Static imports for i18n (must be at top level, not inside components)
import { LocaleProvider, useTranslation } from '@/lib/i18n';
import { useKyc } from '@/lib-client/hooks/useKyc';

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mockCreateU2APayment = vi.hoisted(() => vi.fn());
const mockPiAuthGetToken   = vi.hoisted(() => vi.fn(() => 'test-token'));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: mockCreateU2APayment,
}));

// Mock pi-auth for marketplace-payment and useKyc
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: mockPiAuthGetToken,
  getStoredUser:  vi.fn(() => ({ id: 'user-1' })),
}));

// ── Setup ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockPiAuthGetToken.mockReturnValue('test-token');
  localStorage.clear();
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }) as any
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 1. src/lib/hub/utils.ts — haptic()
// ─────────────────────────────────────────────────────────────────────────
describe('haptic()', () => {
  it('calls navigator.vibrate with 10ms for "light"', async () => {
    const vibrateMock = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateMock });
    const { haptic } = await import('@/lib/hub/utils');
    haptic('light');
    expect(vibrateMock).toHaveBeenCalledWith(10);
    vi.unstubAllGlobals();
  });

  it('calls navigator.vibrate with 25ms for "medium"', async () => {
    const vibrateMock = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateMock });
    const { haptic } = await import('@/lib/hub/utils');
    haptic('medium');
    expect(vibrateMock).toHaveBeenCalledWith(25);
    vi.unstubAllGlobals();
  });

  it('calls navigator.vibrate with 50ms for "heavy"', async () => {
    const vibrateMock = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateMock });
    const { haptic } = await import('@/lib/hub/utils');
    haptic('heavy');
    expect(vibrateMock).toHaveBeenCalledWith(50);
    vi.unstubAllGlobals();
  });

  it('does nothing when navigator has no vibrate support', async () => {
    vi.stubGlobal('navigator', {}); // no vibrate method
    const { haptic } = await import('@/lib/hub/utils');
    expect(() => haptic()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. src/lib-client/pi/marketplace-payment.ts — buyAsset()
// ─────────────────────────────────────────────────────────────────────────
describe('buyAsset()', () => {
  const params = {
    listingId: 'listing-1',
    assetSlug: 'cool-nft',
    price:     5,
    buyerId:   'buyer-1',
  };

  it('returns failure when createU2APayment throws', async () => {
    mockCreateU2APayment.mockRejectedValue(new Error('Pi SDK error'));
    const { buyAsset } = await import('@/lib-client/pi/marketplace-payment');
    const result = await buyAsset(params);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Pi SDK error/);
  });

  it('returns failure when payment status is not completed', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success: true,
      status:  'pending',
      message: 'Still pending',
    });
    const { buyAsset } = await import('@/lib-client/pi/marketplace-payment');
    const result = await buyAsset(params);
    expect(result.success).toBe(false);
  });

  it('returns failure when payment.success is false', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success: false,
      status:  'failed',
      message: 'User cancelled',
    });
    const { buyAsset } = await import('@/lib-client/pi/marketplace-payment');
    const result = await buyAsset(params);
    expect(result.success).toBe(false);
  });

  it('calls buy endpoint and returns success on completed payment', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'p-123',
      txid:      'tx-456',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({ data: { listing: { id: 'listing-1' } } }),
    } as any);
    const { buyAsset } = await import('@/lib-client/pi/marketplace-payment');
    const result = await buyAsset(params);
    expect(result.success).toBe(true);
    expect(result.paymentId).toBe('p-123');
    expect(result.txid).toBe('tx-456');
  });

  it('returns partial failure when payment done but transfer API fails', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'p-123',
      txid:      'tx-789',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   false,
      json: async () => ({ message: 'Transfer failed' }),
    } as any);
    const { buyAsset } = await import('@/lib-client/pi/marketplace-payment');
    const result = await buyAsset(params);
    expect(result.success).toBe(false);
    expect(result.txid).toBe('tx-789');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. src/lib/i18n/index.tsx — LocaleProvider + useTranslation
// ─────────────────────────────────────────────────────────────────────────
describe('LocaleProvider + useTranslation', () => {
  const Consumer = () => {
    const { locale, dir, setLocale } = useTranslation();
    return (
      <div>
        <span data-testid="locale">{locale}</span>
        <span data-testid="dir">{dir}</span>
        <button onClick={() => setLocale('ar')}>switch to ar</button>
      </div>
    );
  };

  const Wrapped = () => (
    <LocaleProvider>
      <Consumer />
    </LocaleProvider>
  );

  it('renders with default "en" locale when localStorage is empty', async () => {
    render(<Wrapped />);
    await act(async () => {});
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('dir').textContent).toBe('ltr');
  });

  it('loads saved "ar" locale from localStorage on mount', async () => {
    localStorage.setItem('tec_locale', 'ar');
    render(<Wrapped />);
    await act(async () => {});
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(screen.getByTestId('dir').textContent).toBe('rtl');
  });

  it('ignores invalid locale and warns, using "en" instead', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('tec_locale', 'fr');
    render(<Wrapped />);
    await act(async () => {});
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"fr"'));
    warnSpy.mockRestore();
  });

  it('setLocale switches locale and persists to localStorage', async () => {
    render(<Wrapped />);
    await act(async () => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(localStorage.getItem('tec_locale')).toBe('ar');
  });

  it('useTranslation throws when used outside LocaleProvider', () => {
    const Crasher = () => { useTranslation(); return null; };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Crasher />)).toThrow('useTranslation must be used within LocaleProvider');
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. src/lib-client/hooks/useKyc.ts — uploadDocs, submit, reset
// ─────────────────────────────────────────────────────────────────────────
describe('useKyc — uploadDocs / submit / reset', () => {
  const successKyc = { id: 'kyc-1', status: 'PENDING' };

  it('uploadDocs sends POST and updates kyc on success', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: successKyc } }) } as any) // fetchStatus
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: { ...successKyc, id_front_url: 'url' } } }) } as any); // upload

    const { result } = renderHook(() => useKyc());
    await waitFor(() => !result.current.isLoading);

    await act(async () => {
      await result.current.uploadDocs({ idFrontUrl: 'url' });
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.kyc?.id_front_url).toBe('url');
  });

  it('uploadDocs sets error and rethrows on API failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: successKyc } }) } as any) // fetchStatus
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Upload failed' }) } as any); // upload fail

    const { result } = renderHook(() => useKyc());
    await waitFor(() => !result.current.isLoading);

    let thrown: Error | null = null;
    await act(async () => {
      try { await result.current.uploadDocs({ idFrontUrl: 'bad-url' }); }
      catch (e) { thrown = e as Error; }
    });

    expect(thrown?.message).toBe('Upload failed');
    expect(result.current.error).toBe('Upload failed');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('submit sends POST /api/kyc/submit and updates kyc', async () => {
    const submittedKyc = { ...successKyc, status: 'PENDING', submitted_at: '2024-01-01' };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: successKyc } }) } as any) // fetchStatus
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: submittedKyc } }) } as any); // submit

    const { result } = renderHook(() => useKyc());
    await waitFor(() => !result.current.isLoading);

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.kyc?.submitted_at).toBe('2024-01-01');
  });

  it('submit sets error and rethrows on failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { kyc: successKyc } }) } as any) // fetchStatus
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Submit failed' }) } as any);

    const { result } = renderHook(() => useKyc());
    await waitFor(() => !result.current.isLoading);

    let thrown: Error | null = null;
    await act(async () => {
      try { await result.current.submit(); }
      catch (e) { thrown = e as Error; }
    });

    expect(thrown?.message).toBe('Submit failed');
    expect(result.current.error).toBe('Submit failed');
  });

  it('reset calls /api/kyc/start then refetches status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ data: { kyc: successKyc } }) } as any);

    const { result } = renderHook(() => useKyc());
    await waitFor(() => !result.current.isLoading);

    await act(async () => {
      await result.current.reset();
    });

    // reset calls /api/kyc/start (POST) then fetchStatus (/api/kyc/status)
    expect(fetchSpy).toHaveBeenCalledWith('/api/kyc/start', expect.objectContaining({ method: 'POST' }));
    expect(result.current.isSubmitting).toBe(false);
  });
});
