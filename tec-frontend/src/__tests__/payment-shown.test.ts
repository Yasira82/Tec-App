import { shownParts, shownText } from '@/lib-client/payment/shown';

/**
 * IIC 4.5 §7 — `shown`.
 *
 * These tests are about one property: the string that reaches the proof is composed
 * from the SAME values the modal renders, and it says enough to settle a dispute months
 * later. A test that only checked the format would pass while the record became useless.
 */

describe('shownParts', () => {
  it('formats the amount exactly as the modal renders it', () => {
    expect(shownParts({ label: 'TEC Nexus', amount: 250, memo: 'Order #12', testnet: false }))
      .toEqual({ label: 'TEC Nexus', amount: '250π', memo: 'Order #12' });
  });

  /**
   * THE ONE THAT MATTERS MOST after the amount. A proof that reads identically for
   * Test-Pi and for real Pi cannot tell apart the two payments a person is most likely
   * to confuse — and this platform has spent a session on exactly that confusion.
   */
  it('records the network only when the modal shows the TESTNET chip', () => {
    expect(shownParts({ label: 'TEC Nexus', amount: 1, memo: 'm', testnet: true }).network)
      .toBe('TESTNET');
    expect(shownParts({ label: 'TEC Nexus', amount: 1, memo: 'm', testnet: false }))
      .not.toHaveProperty('network');
  });
});

describe('shownText', () => {
  it('carries the figure, the app and the description a person would compare against', () => {
    const text = shownText(shownParts({
      label: 'TEC Nexus', amount: 250, memo: 'Order #12', testnet: false,
    }));
    expect(text).toBe('TEC Nexus — 250π — Order #12');
  });

  it('leads with the network when it is Test-Pi, where it cannot be missed', () => {
    const text = shownText(shownParts({
      label: 'TEC Zone', amount: 10, memo: 'Zone Pro', testnet: true,
    }));
    expect(text.startsWith('[TESTNET] ')).toBe(true);
  });

  it('survives an empty memo without leaving a dangling separator', () => {
    expect(shownText(shownParts({ label: 'TEC Hub', amount: 5, memo: '', testnet: false })))
      .toBe('TEC Hub — 5π');
  });

  /**
   * The amount is the field a dispute is actually about, so it must appear verbatim —
   * not rounded, not localised, not abbreviated into something that no longer matches
   * the number on the screen.
   */
  it.each([0.01, 1, 10.5, 250, 1000])('keeps %s π verbatim', (amount) => {
    const text = shownText(shownParts({ label: 'X', amount, memo: 'm', testnet: false }));
    expect(text).toContain(`${amount}π`);
  });
});
