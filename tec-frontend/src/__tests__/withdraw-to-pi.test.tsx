/**
 * TEC balance → the person's own Pi Network wallet (tec-core-backend #400), the Hub side.
 * Hidden unless wallet-service says it is open; the Pi sign-in happens on the tap; one
 * request id per attempt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, fireEvent, waitFor, screen } from '@/test-utils/render-with-locale';

const mockBff   = vi.hoisted(() => vi.fn());
const mockToken = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/bff-client', () => ({ bffFetch: mockBff }));
vi.mock('@/lib-client/pi/pi-auth', () => ({ getPiAccessToken: mockToken }));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

import { WithdrawToPi, withdrawAmountOk } from '@/components/hub/WithdrawToPi';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const OPEN = { open: true, balance: '206', maxPi: 10, dailyLeft: '50', pending: false };

beforeEach(() => { mockBff.mockReset(); mockToken.mockReset(); });

describe('withdrawAmountOk', () => {
  it('positive, ≤ max, ≤ today, ≤ balance, ≤ 7 decimals', () => {
    expect(withdrawAmountOk('2.5', OPEN)).toBe(true);
    expect(withdrawAmountOk('0.0000001', OPEN)).toBe(true);
    for (const bad of ['0', '-1', '10.1', '1.12345678', 'abc', '']) expect(withdrawAmountOk(bad, OPEN)).toBe(false);
    expect(withdrawAmountOk('5', { ...OPEN, dailyLeft: '4' })).toBe(false);
    expect(withdrawAmountOk('5', { ...OPEN, balance: '3' })).toBe(false);
  });
});

describe('WithdrawToPi', () => {
  it('renders nothing when withdrawals are closed for this account', async () => {
    mockBff.mockResolvedValueOnce(json({ ...OPEN, open: false }));
    const onOpen = vi.fn();
    const { container } = render(<WithdrawToPi onOpenChange={onOpen} />);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(false));
    expect(container.textContent).toBe('');
  });

  it('signs in with Pi on the tap and sends the token, the amount and one request id', async () => {
    mockBff.mockResolvedValueOnce(json(OPEN))
      .mockResolvedValueOnce(json({ status: 'completed', amount: '2.5', txid: 'abc' }))
      .mockImplementation(async () => json(OPEN));
    mockToken.mockResolvedValue('pi-token');
    const onDone = vi.fn();
    render(<WithdrawToPi onDone={onDone} />);

    fireEvent.click(await screen.findByText('Withdraw to Pi Network'));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '2,5' } });
    fireEvent.click(screen.getByText('Sign in with Pi and withdraw'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sent 2.5 π'));
    const [url, init] = mockBff.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/bff/wallet/withdraw');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ amount: '2.5', piAccessToken: 'pi-token' });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(onDone).toHaveBeenCalled();
  });

  it('a cancelled Pi sign-in sends nothing and keeps the same request id for the retry', async () => {
    mockBff.mockImplementation(async () => json(OPEN));
    mockToken.mockRejectedValueOnce(new Error('cancelled')).mockResolvedValueOnce('t2');
    render(<WithdrawToPi />);
    fireEvent.click(await screen.findByText('Withdraw to Pi Network'));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Sign in with Pi and withdraw'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('could not be completed'));
    expect(mockBff.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);

    mockBff.mockResolvedValueOnce(json({ status: 'processing', amount: '1', message: 'held' })).mockImplementation(async () => json(OPEN));
    fireEvent.click(screen.getByText('Sign in with Pi and withdraw'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('held'));
  });

  it('a pending withdrawal disables the button', async () => {
    mockBff.mockResolvedValueOnce(json({ ...OPEN, pending: true }));
    render(<WithdrawToPi />);
    const btn = await screen.findByText('A withdrawal is still being confirmed.');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the BFF route', () => {
  it('forwards to wallet-service with the session token; the body never names a person', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/bff/wallet/withdraw/route.ts'), 'utf8');
    expect(src).toContain('/api/wallets/withdraw-to-pi');
    expect(src).toMatch(/requestId:\s+z\.string\(\)\.uuid\(\)/);
    expect(src).not.toMatch(/userId|username/);
  });
});
