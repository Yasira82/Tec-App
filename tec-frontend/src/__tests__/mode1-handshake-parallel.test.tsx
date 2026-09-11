// Mode 1 (`/hub?pay=1&…`) must not run as a straight line.
//
// The report: pay in the Hub, go to an app, pay there — slow. Pay in the app
// FIRST and then in the Hub — instant. The asymmetry is the whole clue, and it
// is not a race: an app entered from the Hub is in a Pi foreign session
// (ADR-007), so its Pay tap BOUNCES here. Arriving here used to mean four
// serial steps before the Pi handshake even started:
//
//     navigate cross-origin → auth resolution settles → POST /payment/create
//     → modal mounts → *now* warm the Pi session → user taps
//
// The reverse order has none of them: the user is already on a warm Hub.
//
// The handshake depends on the SDK and nothing else, so it belongs beside that
// chain rather than after it. These tests pin that it starts while auth is
// still loading — i.e. that the parallelism is real and not an accident of
// effect ordering.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExternalPayment } from '@/lib-client/hooks/useExternalPayment';
import { piSession } from '@/lib-client/pi/pi-session';

const PAY_URL = '/hub?pay=1&amount=1&source=system&product_id=system_supporter';

describe('the Pi handshake starts beside the Mode-1 chain, not after it', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', PAY_URL);
  });

  it('starts while auth is STILL loading — the step that used to block it', async () => {
    const warm = vi.spyOn(piSession, 'ensurePaymentsReady').mockResolvedValue(true);

    renderHook(() => useExternalPayment({
      isLoading: true,            // auth not settled — the old blocker
      piReady:   true,
      user:      null,
      onError:   () => {},
    }));

    await waitFor(() => expect(warm).toHaveBeenCalledTimes(1));
  });

  it('starts before the payment record exists — no create round-trip first', async () => {
    const order: string[] = [];
    vi.spyOn(piSession, 'ensurePaymentsReady').mockImplementation(async () => {
      order.push('handshake'); return true;
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      order.push('create');
      return { ok: true, json: async () => ({ data: { payment: { id: 'p1' } } }) } as unknown as Response;
    }));

    renderHook(() => useExternalPayment({
      isLoading: false,
      piReady:   true,
      user:      { id: 'u1' },
      onError:   () => {},
    }));

    await waitFor(() => expect(order).toContain('create'));
    expect(order[0]).toBe('handshake');
    vi.unstubAllGlobals();
  });

  it('does not touch Pi before the SDK is ready', async () => {
    const warm = vi.spyOn(piSession, 'ensurePaymentsReady').mockResolvedValue(true);

    renderHook(() => useExternalPayment({
      isLoading: false,
      piReady:   false,
      user:      { id: 'u1' },
      onError:   () => {},
    }));

    await new Promise(r => setTimeout(r, 0));
    expect(warm).not.toHaveBeenCalled();
  });

  it('does nothing at all when this is not a Mode-1 handoff', async () => {
    window.history.replaceState({}, '', '/hub');
    const warm = vi.spyOn(piSession, 'ensurePaymentsReady').mockResolvedValue(true);

    renderHook(() => useExternalPayment({
      isLoading: false,
      piReady:   true,
      user:      { id: 'u1' },
      onError:   () => {},
    }));

    await new Promise(r => setTimeout(r, 0));
    expect(warm).not.toHaveBeenCalled();
  });

  it('a failing handshake never breaks the handoff — the tap retries', async () => {
    vi.spyOn(piSession, 'ensurePaymentsReady').mockRejectedValue(new Error('TIMEOUT'));
    const fetchMock = vi.fn(async () => (
      { ok: true, json: async () => ({ data: { payment: { id: 'p1' } } }) } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useExternalPayment({
      isLoading: false,
      piReady:   true,
      user:      { id: 'u1' },
      onError:   () => {},
    }));

    await waitFor(() => expect(result.current.external?.internalId).toBe('p1'));
    vi.unstubAllGlobals();
  });
});
