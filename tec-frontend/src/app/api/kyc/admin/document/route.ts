import { NextRequest, NextResponse } from 'next/server';

// Admin-only: resolve a stored KYC document key to a short-lived presigned GET
// URL so the reviewer can view the image. Gateway → tec-storage-service enforces
// role==='admin'. A presigned GET URL renders in an <img> cross-origin (image
// loads are not CORS-blocked), so the page uses the returned url directly.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = req.nextUrl.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const res  = await fetch(`${GATEWAY}/api/storage/admin/download-url`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
