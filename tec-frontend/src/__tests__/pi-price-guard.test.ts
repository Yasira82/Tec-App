/**
 * The Hub used to store whatever `/api/market/pi-price` returned, gated only on
 * `if (!d.error)`.
 *
 * That route is genuinely well guarded — every failure path returns
 * `{ error: … }`. The hole was a SUCCESSFUL response whose shape had drifted:
 * it builds its body with `parseFloat(data.last)` against a third-party feed,
 * `parseFloat(undefined)` is NaN, and `JSON.stringify` writes NaN as `null`.
 * So a 200 could carry `{ price: null, high24h: null, … }` with no error key,
 * the client stored it, and the first `piPrice.high24h.toFixed(4)` threw —
 * taking the entire Hub to the error boundary because a price chip failed.
 *
 * These cases are the shapes that actually reach it, not invented ones.
 */
import { describe, it, expect } from 'vitest';
import { asPiPrice } from '@/lib/hub/types';

const good = { price: 0.0878, change24h: -7.53, high24h: 0.095, low24h: 0.086 };

describe('a good reading passes through', () => {
  it('keeps all four fields', () => {
    expect(asPiPrice(good)).toEqual(good);
  });

  it('accepts a zero change — a flat day is real data', () => {
    expect(asPiPrice({ ...good, change24h: 0 })).not.toBeNull();
  });

  it('ignores extra fields the route also sends', () => {
    // vol24h and timestamp are in the real response and are not consumed.
    expect(asPiPrice({ ...good, vol24h: 123, timestamp: '2026-08-23T00:00:00Z' }))
      .toEqual(good);
  });
});

describe('the shapes that used to crash the Hub', () => {
  it('rejects NaN serialised as null — the actual failure', () => {
    expect(asPiPrice({ price: null, change24h: null, high24h: null, low24h: null })).toBeNull();
  });

  it('rejects a PARTIAL reading rather than patching the gaps', () => {
    // Price is real, the 24h fields are not. Showing the price beside a
    // zeroed change is a worse lie than showing nothing: one is a visible
    // absence, the other is a confident wrong number.
    expect(asPiPrice({ ...good, high24h: null })).toBeNull();
    expect(asPiPrice({ price: 0.0878 })).toBeNull();
  });

  it('rejects numbers arriving as strings', () => {
    // A feed that switches to string amounts passes `!d.error` and then
    // `"0.0878".toFixed` throws.
    expect(asPiPrice({ ...good, price: '0.0878' })).toBeNull();
  });

  it('does not let an empty string or null become a plausible zero', () => {
    // Number('') and Number(null) are both 0, so a coercion-first check would
    // have invented a $0.00 price out of a missing field.
    expect(asPiPrice({ ...good, price: '' })).toBeNull();
    expect(asPiPrice({ ...good, low24h: null })).toBeNull();
  });

  it('rejects a raw Infinity', () => {
    expect(asPiPrice({ ...good, change24h: Infinity })).toBeNull();
  });
});

describe('the paths it already handled', () => {
  it.each([
    ['the error envelope', { error: 'Price unavailable' }],
    ['the rate-limit envelope', { error: 'Too many requests' }],
    ['null', null],
    ['undefined', undefined],
    ['a string body', 'Price unavailable'],
    ['an array', []],
  ])('rejects %s', (_label, input) => {
    expect(asPiPrice(input)).toBeNull();
  });
});
