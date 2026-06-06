import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

const ALLOWED_ENDPOINTS = new Set(['overview', 'payments', 'users', 'events', 'metrics', 'daily']);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint = req.nextUrl.searchParams.get('endpoint') ?? 'overview';

  // ✅ P0-2: whitelist validation — no path traversal
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  try {
    const res = await fetch(`${GATEWAY}/api/analytics/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
