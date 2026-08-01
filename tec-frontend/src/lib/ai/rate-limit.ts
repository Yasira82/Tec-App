/**
 * TEC AI — chat rate limiter (edge-safe, durable-capable).
 *
 * The chat route runs on the EDGE (no TCP sockets → ioredis can't be used). So the
 * durable backend is an Upstash-compatible Redis REST endpoint, reached over fetch:
 *   - configured (UPSTASH_REDIS_REST_URL + _TOKEN) → a SHARED fixed-window counter,
 *     correct across every edge instance/region.
 *   - not configured → a BOUNDED in-memory fallback (best-effort per instance).
 *
 * Fail-open by design: a hiccup in the durable backend degrades to in-memory rather
 * than locking authenticated users out of a paid feature. The limit protects the AI
 * budget; it is not a security control (auth already gates the route).
 */

export interface RateResult {
  ok:        boolean;
  remaining: number;
}

export const RATE_LIMIT    = 20;   // requests…
export const RATE_WINDOW_S = 60;   // …per this many seconds, per authenticated user

// ── Durable backend: Upstash Redis REST (edge-safe, atomic fixed window) ──────
// One round-trip pipeline: INCR the per-user key; set EXPIRE only on the first hit
// (NX) so the window doesn't slide. Returns null when unconfigured or on any error
// → the caller falls back to in-memory (fail-open).
async function durableCheck(key: string): Promise<RateResult | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const rk = `airl:${key}`;
    const res = await fetch(`${url}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([['INCR', rk], ['EXPIRE', rk, String(RATE_WINDOW_S), 'NX']]),
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const data  = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result ?? NaN);
    if (!Number.isFinite(count) || count <= 0) return null;
    return { ok: count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - count) };
  } catch {
    return null; // fail-open → in-memory
  }
}

// ── In-memory fallback (bounded — never leaks on a long-lived edge instance) ──
interface Entry { count: number; resetAt: number }
const mem = new Map<string, Entry>();
const MAX_KEYS = 10_000;

function prune(now: number): void {
  for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k);
  if (mem.size > MAX_KEYS) {
    // still over cap after removing expired → drop the soonest-to-reset entries.
    const oldest = [...mem.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < oldest.length - MAX_KEYS; i++) mem.delete(oldest[i][0]);
  }
}

function memCheck(key: string): RateResult {
  const now = Date.now();
  if (mem.size > MAX_KEYS) prune(now);

  const e = mem.get(key);
  if (e && now < e.resetAt) {
    if (e.count >= RATE_LIMIT) return { ok: false, remaining: 0 };
    e.count += 1;
    return { ok: true, remaining: RATE_LIMIT - e.count };
  }
  mem.set(key, { count: 1, resetAt: now + RATE_WINDOW_S * 1000 });
  return { ok: true, remaining: RATE_LIMIT - 1 };
}

/** Consume one unit for `key` (the authenticated user id). Durable if configured. */
export async function checkRateLimit(key: string): Promise<RateResult> {
  return (await durableCheck(key)) ?? memCheck(key);
}

/** Test-only: reset the in-memory window. */
export function __resetMemRateLimit(): void { mem.clear(); }
