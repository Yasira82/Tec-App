import { NextResponse } from 'next/server';

/**
 * Per-service health for the Hub (pi-test "Check All Services").
 *
 * It asks the gateway's `/health/detailed`, which calls each service's own `/health`
 * on the private network and returns one verdict per service. Until 8 Nov 2026 this
 * route asked `/api/<svc>/health` through the public proxy instead: the gateway rewrites
 * that to `/<svc>/health`, a path the services do not serve, so most of them read
 * "error" while they were running — and on the day payment-service really was down,
 * this page could not tell. `/health/detailed` needs the internal key (server-only).
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

type ServiceResult = { name: string; status: 'ok' | 'error'; ms: number };

export async function GET() {
  if (!GATEWAY) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  }

  const t0 = Date.now();
  const services: ServiceResult[] = [];

  try {
    const res = await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    services.push({ name: 'gateway', status: res.ok ? 'ok' : 'error', ms: Date.now() - t0 });
  } catch {
    services.push({ name: 'gateway', status: 'error', ms: Date.now() - t0 });
  }

  const t1 = Date.now();
  try {
    if (!process.env.INTERNAL_SECRET) throw new Error('INTERNAL_SECRET not set');
    const res = await fetch(`${GATEWAY}/health/detailed`, {
      headers: { 'x-internal-key': process.env.INTERNAL_SECRET },
      signal:  AbortSignal.timeout(6000),
      cache:   'no-store',
    });
    // 200 = every dependency ok, 207 = some degraded; both carry the verdicts.
    if (!res.ok && res.status !== 207) throw new Error(`gateway ${res.status}`);
    const data = await res.json() as { dependencies?: Record<string, string> };
    const ms   = Date.now() - t1;
    for (const [name, verdict] of Object.entries(data.dependencies ?? {})) {
      services.push({ name, status: verdict === 'ok' ? 'ok' : 'error', ms });
    }
    if (!data.dependencies) throw new Error('no dependencies in the answer');
  } catch {
    // Unknown is not healthy (P6): say the per-service check itself failed.
    services.push({ name: 'services (per-service check)', status: 'error', ms: Date.now() - t1 });
  }

  const allOk = services.every(s => s.status === 'ok');
  return NextResponse.json({ ok: allOk, services }, { status: allOk ? 200 : 207 });
}
