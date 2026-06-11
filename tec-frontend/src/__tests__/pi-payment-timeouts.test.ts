/**
 * pi-payment.ts — remaining uncovered paths:
 *   retryFetch retry/exhaustion, approval/completion timeout timers,
 *   invalid ID formats, completion !ok, onError scope-lost,
 *   synchronous createPayment throw + retry, getPaymentStatus error.
 *
 * payment-timeouts is mocked with tiny values so real timers fire fast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib-client/pi/payment-timeouts', () => ({
  APPROVAL_TIMEOUT_MS:        250,
  COMPLETION_TIMEOUT_MS:      250,
  RETRIABLE_STATUS_CODES:     new Set([429, 404]),
  NON_RETRIABLE_STATUS_CODES: new Set([400, 401, 403]),
  MAX_RETRIES:                2,
  RETRY_BASE_DELAY_MS:        1,
}));

const mockEnsurePaymentsReady = vi.hoisted(() => vi.fn());
const mockSessionReset        = vi.hoisted(() => vi.fn());
const mockSessionReInit       = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensurePaymentsReady: mockEnsurePaymentsReady,
    ensureAuth:          vi.fn(() => Promise.resolve(true)),
    reset:               mockSessionReset,
    reInit:              mockSessionReInit,
    lastError:           null,
  },
  PiAuthError: class PiAuthError extends Error {},
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok-1'),
  getStoredUser:  vi.fn(() => ({ id: 'u-1', piUsername: 'alice' })),
  isPiBrowser:    vi.fn(() => true),
}));

const mockGetPayment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sdk', () => ({
  default: {
    payment: {
      getPayment:        mockGetPayment,
      resolveIncomplete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders: vi.fn(() => ({ 'x-request-id': 'req-1' })),
}));

import {
  createU2APayment,
  createA2UPayment,
  getPaymentStatus,
} from '@/lib-client/pi/pi-payment';

type PiCallbacks = {
  onReadyForServerApproval:   (pid: string) => Promise<void> | void;
  onReadyForServerCompletion: (pid: string, txid: string) => Promise<void> | void;
  onCancel:                   () => void;
  onError:                    (e: Error) => void;
};

let capturedCbs: PiCallbacks | null = null;
let createPaymentImpl: (config: unknown, cbs: PiCallbacks) => void;

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsurePaymentsReady.mockResolvedValue(true);
  capturedCbs = null;
  createPaymentImpl = (_cfg, cbs) => { capturedCbs = cbs; };
  (window as any).Pi = {
    createPayment: vi.fn((cfg: unknown, cbs: PiCallbacks) => createPaymentImpl(cfg, cbs)),
    authenticate:  vi.fn(),
  };
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ data: {} }),
  } as Response);
});

const waitForCbs = () => vi.waitFor(() => expect(capturedCbs).not.toBeNull());

describe('createU2APayment timers', () => {
  it('rejects when approval times out (no callback ever fires)', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await expect(p).rejects.toThrow(/approval timed out/i);
  });

  it('rejects when completion times out after successful approval', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await capturedCbs!.onReadyForServerApproval('pi-valid-id-1');
    await expect(p).rejects.toThrow(/completion timed out/i);
  });

  it('ignores approval callback after the payment already timed out', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await expect(p).rejects.toThrow(/timed out/i);
    // Fire callback late — guard returns early without throwing
    await capturedCbs!.onReadyForServerApproval('pi-valid-id-1');
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/payment/approve', expect.anything(),
    );
  });
});

describe('createU2APayment validation failures', () => {
  it('rejects invalid pi payment id in approval callback', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await capturedCbs!.onReadyForServerApproval('bad id with spaces!');
    await expect(p).rejects.toThrow(/Invalid payment ID format/);
  });

  it('rejects invalid pi payment id in completion callback', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await capturedCbs!.onReadyForServerCompletion('bad id!!', 'a'.repeat(16));
    await expect(p).rejects.toThrow(/Invalid payment ID format/);
  });

  it('rejects invalid txid format in completion callback', async () => {
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await capturedCbs!.onReadyForServerCompletion('pi-valid-id-1', 'x!');
    await expect(p).rejects.toThrow(/Invalid transaction ID format/);
  });

  it('rejects when completion endpoint returns !ok', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/payment/complete')) {
        return { ok: false, status: 500, json: async () => ({ message: 'Ledger write failed' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    await capturedCbs!.onReadyForServerCompletion('pi-valid-id-1', 'tx_' + 'a'.repeat(12));
    await expect(p).rejects.toThrow('Ledger write failed');
  });
});

describe('createU2APayment onError paths', () => {
  it('scope error resets session and dispatches tec:pi:scope:lost', async () => {
    const scopeListener = vi.fn();
    window.addEventListener('tec:pi:scope:lost', scopeListener);
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await waitForCbs();
    capturedCbs!.onError(new Error('scope permission denied'));
    await expect(p).rejects.toThrow(/scope permission denied/);
    expect(mockSessionReset).toHaveBeenCalled();
    expect(scopeListener).toHaveBeenCalled();
    window.removeEventListener('tec:pi:scope:lost', scopeListener);
  });
});

describe('createU2APayment synchronous throw retry', () => {
  it('retries once when createPayment throws "not initialized" synchronously', async () => {
    let calls = 0;
    createPaymentImpl = (_cfg, cbs) => {
      calls += 1;
      if (calls === 1) throw new Error('Pi not initialized — call init() first');
      capturedCbs = cbs;
    };
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await vi.waitFor(() => expect(calls).toBe(2));
    await waitForCbs();
    // Complete the payment on the retried invocation
    await capturedCbs!.onReadyForServerCompletion('pi-valid-id-1', 'tx_' + 'a'.repeat(12));
    const result = await p;
    expect(result.success).toBe(true);
    expect(mockSessionReset).toHaveBeenCalled();
  });

  it('rejects when retry gate fails after sync "not initialized" throw', async () => {
    createPaymentImpl = () => { throw new Error('init() not called'); };
    mockEnsurePaymentsReady
      .mockResolvedValueOnce(true)   // initial gate in createU2APayment
      .mockResolvedValueOnce(false); // retry gate fails
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await expect(p).rejects.toThrow(/init\(\)/);
  });

  it('rejects immediately on non-init synchronous throw', async () => {
    createPaymentImpl = () => { throw new Error('boom from SDK'); };
    const p = createU2APayment(1, 'Test', {}, 'int-1');
    await expect(p).rejects.toThrow('boom from SDK');
  });
});

describe('createA2UPayment retryFetch behaviour', () => {
  it('retries on 429 then succeeds', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ success: true }) });
    const result = await createA2UPayment({ toUserId: 'u-2', amount: 1, memo: 'm' } as any);
    expect((result as any).success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns non-retriable status immediately (401 → session message)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }),
    });
    await expect(createA2UPayment({ toUserId: 'u-2', amount: 1, memo: 'm' } as any))
      .rejects.toThrow('Unauthorized');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws last network error after exhausting retries', async () => {
    (global.fetch as any).mockRejectedValue(new Error('ECONNRESET'));
    await expect(createA2UPayment({ toUserId: 'u-2', amount: 1, memo: 'm' } as any))
      .rejects.toThrow('ECONNRESET');
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 + MAX_RETRIES(2)
  });

  it('uses error.error.message from A2U error body when present', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: { message: 'Bad recipient' } }),
    });
    await expect(createA2UPayment({ toUserId: 'x', amount: 1, memo: 'm' } as any))
      .rejects.toThrow('Bad recipient');
  });
});

describe('getPaymentStatus', () => {
  it('returns payment from sdk', async () => {
    mockGetPayment.mockResolvedValue({ status: 'completed' });
    const result = await getPaymentStatus('pay-1');
    expect(result.status).toBe('completed');
  });

  it('wraps sdk errors', async () => {
    mockGetPayment.mockRejectedValue(new Error('gateway 503'));
    await expect(getPaymentStatus('pay-1')).rejects.toThrow('gateway 503');
  });
});
