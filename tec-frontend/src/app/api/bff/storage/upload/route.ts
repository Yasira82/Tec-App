import { NextRequest, NextResponse } from 'next/server';

// Server-proxied document upload. The browser POSTs the file to THIS same-origin
// route (no CORS), then the server:
//   1. asks tec-storage-service (via the gateway) for a presigned upload URL,
//   2. PUTs the bytes to storage (R2) itself — server→R2 has no CORS restriction.
// This avoids the browser→R2 CORS failure ("Failed to fetch") that a direct
// presigned PUT hits unless the R2 bucket is CORS-configured for the Hub origin.
// Returns { data: { key } } — the durable storage reference for the KYC record.
export const runtime = 'nodejs';

const GATEWAY      = process.env.API_GATEWAY_URL ?? '';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES    = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WEBP or HEIC images are allowed' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be between 0 and 10MB' }, { status: 400 });
    }

    // 1) presigned URL from storage-service
    const urlRes = await fetch(`${GATEWAY}/api/storage/upload-url`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size, folder: 'kyc' }),
    });
    const urlData = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) {
      return NextResponse.json({ error: urlData?.error ?? 'Storage is unavailable' }, { status: 502 });
    }
    const uploadUrl: string | undefined = urlData?.data?.uploadUrl ?? urlData?.uploadUrl;
    const key:       string | undefined = urlData?.data?.key       ?? urlData?.key;
    if (!uploadUrl || !key) {
      return NextResponse.json({ error: 'Storage did not return an upload URL' }, { status: 502 });
    }

    // 2) server-side PUT of the bytes to R2 (no CORS from the server)
    const putRes = await fetch(uploadUrl, {
      method:  'PUT',
      headers: { 'Content-Type': file.type },
      body:    Buffer.from(await file.arrayBuffer()),
    });
    if (!putRes.ok) {
      return NextResponse.json({ error: `Storage upload failed (${putRes.status})` }, { status: 502 });
    }

    return NextResponse.json({ data: { key } }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
