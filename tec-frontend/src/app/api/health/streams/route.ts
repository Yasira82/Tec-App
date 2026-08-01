import { NextResponse } from 'next/server';

/**
 * Consumer-liveness surface for the Hub (the "nervous-system" sensor).
 *
 * The gateway's /health/detailed aggregates identity-service's /health/streams —
 * one Redis connection that sees EVERY consumer group via read-only XINFO. This BFF
 * route relays just the `streams` verdict so the Hub (and any uptime monitor pointed
 * at it) can see whether a consumer died or a stream mismatch appeared — the exact
 * silent breakage that hit Explorer-KYC and the analytics crash.
 *
 * INFORMATIONAL: this is NOT the platform liveness poller (that stays /api/health,
 * C-96 single-poller). A lagging/dead consumer surfaces here without ever flipping the
 * Hub to "Backend Offline" (NEW-W). Always returns 200 with a verdict in the body.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET() {
  if (!GATEWAY) {
    return NextResponse.json({ ok: false, redis: 'unavailable', error: 'not configured' });
  }
  if (!process.env.INTERNAL_SECRET) {
    return NextResponse.json({ ok: false, redis: 'unavailable', error: 'not configured' });
  }

  try {
    const res = await fetch(`${GATEWAY}/health/detailed`, {
      headers: { 'x-internal-key': process.env.INTERNAL_SECRET },
      signal:  AbortSignal.timeout(6000),
      cache:   'no-store',
    });
    // /health/detailed returns 200 (all ok) or 207 (a dependency degraded) — both carry a body.
    if (!res.ok && res.status !== 207) {
      return NextResponse.json({ ok: false, redis: 'unavailable', error: `gateway ${res.status}` });
    }
    const data    = await res.json() as { streams?: unknown };
    const streams = data.streams;
    if (!streams || streams === 'unavailable') {
      return NextResponse.json({ ok: false, redis: 'unavailable' });
    }
    return NextResponse.json(streams);
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      redis: 'unavailable',
      error: err instanceof Error ? err.message : 'Failed to reach gateway',
    });
  }
}
