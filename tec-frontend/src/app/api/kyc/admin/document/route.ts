import { NextRequest, NextResponse } from 'next/server';

// Admin-only: stream a stored KYC document image to the reviewer, SAME-ORIGIN.
// The Hub server fetches the raw bytes from tec-storage-service (which reads the
// object directly from R2 server-side) and pipes them back, so the browser never
// touches R2 — no presigned-GET signature/CORS/param issues. Gateway →
// storage-service enforces role==='admin'. Used directly as an <img> src.
export const runtime = 'nodejs';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = req.nextUrl.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const res = await fetch(`${GATEWAY}/api/storage/admin/object`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err?.error ?? `Document unavailable (${res.status})` }, { status: res.status });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':  res.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
