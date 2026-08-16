import { NextResponse } from 'next/server';

export async function GET() {
  const gatewayUrl = process.env.API_GATEWAY_URL ?? '';

  if (!gatewayUrl) {
    return NextResponse.json({ online: false, error: 'not configured' });
  }

  try {
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: AbortSignal.timeout(10000), // align with gateway proxyTimeout=10s — no 499 ghost-aborts
    });

    if (!res.ok) {
      return NextResponse.json({ online: false, error: `status ${res.status}` });
    }

    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch (err) {
    return NextResponse.json({
      online: false,
      error:  err instanceof Error ? err.message : 'Failed to reach gateway',
    });
  }
}
