import { NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL! ?? '';

type ServiceResult = { name: string; status: 'ok' | 'error'; ms: number };

const SERVICES: { name: string; path: string }[] = [
  { name: 'Gateway',      path: '/health' },
  { name: 'Auth',         path: '/api/auth/health' },
  { name: 'Payment',      path: '/api/payment/health' },
  { name: 'Commerce',     path: '/api/commerce/health' },
  { name: 'Identity',     path: '/api/identity/health' },
  { name: 'Assets',       path: '/api/assets/health' },
  { name: 'KYC',          path: '/api/kyc/health' },
  { name: 'Notifications',path: '/api/notifications/health' },
];

export async function GET() {
  if (!GATEWAY) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  }

  const results = await Promise.allSettled(
    SERVICES.map(async ({ name, path }): Promise<ServiceResult> => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${GATEWAY}${path}`, {
          headers: { 'x-internal-key': process.env.INTERNAL_SECRET ?? '' },
          signal:  AbortSignal.timeout(4000),
          cache:   'no-store',
        });
        return { name, status: res.ok ? 'ok' : 'error', ms: Date.now() - t0 };
      } catch {
        return { name, status: 'error', ms: Date.now() - t0 };
      }
    }),
  );

  const services = results.map(r =>
    r.status === 'fulfilled' ? r.value : { name: 'unknown', status: 'error' as const, ms: 0 },
  );

  const allOk = services.every(s => s.status === 'ok');

  return NextResponse.json({ ok: allOk, services }, { status: allOk ? 200 : 207 });
}
