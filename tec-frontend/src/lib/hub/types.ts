export interface PiPrice {
  price:    number;
  change24h: number;
  high24h:  number;
  low24h:   number;
}

/**
 * Accept a price payload only if EVERY field is a real number.
 *
 * `/api/market/pi-price` is well guarded — any failure returns `{ error }`,
 * and the client skipped on that. What it could not skip was a 200 whose
 * SHAPE had changed: the route builds its response with `parseFloat(data.last)`
 * against a third-party feed, and `parseFloat(undefined)` is NaN, which
 * `JSON.stringify` writes as `null`. The client then stored
 * `{ price: null, high24h: null, … }` — no `error` key, so it looked fine —
 * and the first `piPrice.high24h.toFixed(4)` threw, taking the WHOLE Hub to
 * the error boundary. A price widget is not allowed to cost the page.
 *
 * Partial data is rejected too, not patched: the four fields are one reading,
 * and a card showing a real price beside a zeroed 24h change is a worse lie
 * than a card showing nothing. Returning null hides the widget and leaves the
 * rest of the Hub standing.
 */
export function asPiPrice(input: unknown): PiPrice | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as Record<string, unknown>;
  if ('error' in d && d.error) return null;

  const out: Record<string, number> = {};
  for (const k of ['price', 'change24h', 'high24h', 'low24h'] as const) {
    // Number('') is 0 and Number(null) is 0, so the typeof check comes first —
    // a missing field must not resolve to a plausible zero.
    if (typeof d[k] !== 'number' || !Number.isFinite(d[k])) return null;
    out[k] = d[k] as number;
  }
  return out as unknown as PiPrice;
}

export interface HubApp {
  slug:  string;
  name:  string;
  emoji: string;
  href:  string;
  desc:  string;
  group?: string;
}
