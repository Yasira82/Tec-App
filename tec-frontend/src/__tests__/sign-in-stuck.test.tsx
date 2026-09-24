/**
 * "Sign in with Pi" says where it is, and offers a way out when Pi is silent.
 *
 * Seen on a phone: the button sat on "Connecting..." and, 45 seconds later,
 * said to check the internet connection — while every request before and after
 * it reached the server. The Vercel log had no `pi-login` at all: the wait was
 * inside `Pi.authenticate`, which does not fail when Pi Browser's app context
 * belongs to another app; it simply never replies (C-02, C-76). Closing and
 * reopening recovered, because only a fresh page resets that context.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockLoginWithPi = vi.hoisted(() => vi.fn());
const SILENT = 'Pi did not respond. Tap "Try again" to reload the page.';

vi.mock('@/lib-client/pi/pi-auth', () => ({
  loginWithPi: mockLoginWithPi,
  isPiSilent:  (err: unknown) => err instanceof Error && err.message === SILENT,
}));
vi.mock('@/lib-client/pi/PiRuntime', () => ({ PiRuntime: { isAvailable: () => true } }));

import PiPaymentButton, { PI_SILENT_OFFER_MS } from '@/components/payment/PiPaymentButton';

const reload = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  reload.mockReset();
  mockLoginWithPi.mockReset();
  Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
  Object.defineProperty(window, 'location', {
    value: { href: 'https://hub.tecosystem.app/', search: '', origin: 'https://hub.tecosystem.app', reload },
    writable: true, configurable: true,
  });
});
afterEach(() => { vi.useRealTimers(); });

const tap = async () => {
  render(<PiPaymentButton />);
  await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
};

describe('the sign-in button names the step it is waiting on', () => {
  it('says it is waiting for Pi while Pi.authenticate runs', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    expect(screen.getByText('Waiting for Pi…')).toBeInTheDocument();
  });

  it('says it is signing in once Pi has answered', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); onStage('server'); return new Promise(() => {}); });
    await tap();
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
  });
});

describe('a silent Pi gets a way out, early', () => {
  it('offers "Try again" after PI_SILENT_OFFER_MS — not after the full 45s', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    expect(screen.queryByText('Try again')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS); });
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(PI_SILENT_OFFER_MS).toBeLessThan(45_000);
  });

  it('does not offer it while OUR server is working — that half is not the one that hangs', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); onStage('server'); return new Promise(() => {}); });
    await tap();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS * 2); });
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('"Try again" reloads the page — the only thing that resets Pi’s context', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS); });
    fireEvent.click(screen.getByText('Try again'));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('when Pi finally times out, says Pi did not respond — not "check your internet"', async () => {
    mockLoginWithPi.mockRejectedValue(new Error(SILENT));
    await tap();
    expect(screen.getByText(SILENT)).toBeInTheDocument();
    expect(screen.queryByText(/internet/i)).toBeNull();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});

describe('a reload is not assumed to be enough (C-76: Pi kept ownership across one)', () => {
  it('remembers that "Try again" was used', async () => {
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS); });
    fireEvent.click(screen.getByText('Try again'));
    expect(sessionStorage.getItem('tec_pi_signin_retried')).toMatch(/^\d+$/);
  });

  it('if Pi is silent again after it, names the step that works instead of the same button', async () => {
    sessionStorage.setItem('tec_pi_signin_retried', String(Date.now()));
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS); });
    expect(screen.getByText(/Close Pi Browser completely/)).toBeInTheDocument();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('forgets an old retry, so a later visit gets the quick button again', async () => {
    sessionStorage.setItem('tec_pi_signin_retried', String(Date.now() - 10 * 60_000));
    mockLoginWithPi.mockImplementation(({ onStage }) => { onStage('pi'); return new Promise(() => {}); });
    await tap();
    await act(async () => { vi.advanceTimersByTime(PI_SILENT_OFFER_MS); });
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});

describe('a sign-in that returns no session never leaves "Connecting..." for good', () => {
  it('says it did not complete and offers a retry', async () => {
    mockLoginWithPi.mockResolvedValue({ success: false });
    await tap();
    expect(screen.queryByText('Connecting...')).toBeNull();
    expect(screen.getByText('Sign-in did not complete.')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});
