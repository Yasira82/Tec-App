import { NextRequest, NextResponse } from 'next/server';

// BFF: request a short-lived presigned upload URL from tec-storage-service
// (via the gateway). The browser then PUTs the file bytes straight to storage
// (R2) — the file never passes through the Hub server. Returns { uploadUrl,
// key, fileId }: `key` is the durable reference persisted on the KYC record.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES    = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { filename, mimeType, size, folder } = body ?? {};

    // Fail closed on anything that isn't a sane image (P6).
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WEBP or HEIC images are allowed' }, { status: 400 });
    }
    if (typeof size !== 'number' || size <= 0 || size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be between 0 and 10MB' }, { status: 400 });
    }

    const res = await fetch(`${GATEWAY}/api/storage/upload-url`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filename, mimeType, size, folder: folder ?? 'kyc' }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
