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

// ── Attachments: a daily allowance (owner, 2026-10-08) ─────────────────────────
// A photo or a PDF costs the AI budget far more than a line of text, so each person
// gets ATTACHMENTS_PER_DAY a day. Same shape as the limiter above: durable when Upstash
// is configured, bounded in-memory otherwise, fail-open on a backend hiccup.
//
// Counted per DISTINCT file (owner, 2026-10-09: "attach once"). Files now stay attached
// across a conversation and go with every message, so counting per send would spend the
// day's allowance on one photo asked about ten times. Each file is identified by a hash
// of its bytes; one already counted today is free.
const dayMem = new Map<string, { ids: Set<string>; resetAt: number }>();

type Cmd = (string | number)[];
async function upstash(url: string, token: string, cmds: Cmd[]): Promise<unknown[] | null> {
  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(cmds.map(c => c.map(String))),
    cache:   'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ result?: unknown; error?: unknown }>;
  return Array.isArray(data) && !data.some(d => d?.error) ? data.map(d => d?.result) : null;
}

export async function checkAttachmentAllowance(key: string, fileIds: string[], perDay: number): Promise<RateResult> {
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (!ids.length) return { ok: true, remaining: perDay };
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const rk = `aiatt2:${key}:${new Date().toISOString().slice(0, 10)}`;
      const seen = await upstash(url, token, [['SMISMEMBER', rk, ...ids], ['SCARD', rk]]);
      if (seen) {
        const flags = (seen[0] as unknown[]) ?? [];
        const fresh = ids.filter((_, i) => Number(flags[i]) !== 1);
        const used  = Number(seen[1] ?? 0);
        if (!fresh.length) return { ok: true, remaining: Math.max(0, perDay - used) };
        if (used + fresh.length > perDay) return { ok: false, remaining: Math.max(0, perDay - used) };
        const added = await upstash(url, token, [['SADD', rk, ...fresh], ['EXPIRE', rk, 90000, 'NX']]);
        if (added) return { ok: true, remaining: Math.max(0, perDay - used - fresh.length) };
      }
    } catch { /* fall through to memory */ }
  }
  const now = Date.now();
  let e = dayMem.get(key);
  if (!e || now >= e.resetAt) {
    if (dayMem.size > MAX_KEYS) dayMem.clear();
    e = { ids: new Set(), resetAt: now + 86_400_000 };
    dayMem.set(key, e);
  }
  const fresh = ids.filter(id => !e!.ids.has(id));
  if (e.ids.size + fresh.length > perDay) return { ok: false, remaining: Math.max(0, perDay - e.ids.size) };
  for (const id of fresh) e.ids.add(id);
  return { ok: true, remaining: perDay - e.ids.size };
}

/** Test-only. */
export function __resetAttachmentAllowance(): void { dayMem.clear(); }
