import { NextResponse } from 'next/server';

// Public campaign state: reward, seats, remaining, which apps. No per-user data,
// so no auth — this is what the landing copy reads.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET() {
  try {
    const res  = await fetch(`${GATEWAY}/api/identity/campaign/status`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    // A campaign whose state cannot be read is presented as CLOSED, never as
    // open: the page must not invite someone to earn Pi it cannot confirm is
    // still on offer (P6).
    return NextResponse.json({ success: false, data: { open: false } }, { status: 200 });
  }
}
