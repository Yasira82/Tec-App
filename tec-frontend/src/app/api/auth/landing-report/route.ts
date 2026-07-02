import { NextRequest, NextResponse } from 'next/server';

// ⚠️ TEMP diagnostic sink — the login landing page POSTs here when it could not
// make the session server-visible. The console output lands in the runtime
// logs, so the exact browser-side failure mode (which cookies exist in
// document.cookie, whether the request itself carried any cookies) is
// diagnosable without asking the user. Delete once login is stable.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.warn('[landing-report]', JSON.stringify({
    ...body,
    // What the SERVER received on this very request — the ground truth.
    serverSawCookies: {
      access:  !!req.cookies.get('tec_access_token')?.value,
      user:    !!req.cookies.get('tec_user')?.value,
      csrf:    !!req.cookies.get('tec_csrf')?.value,
      refresh: !!req.cookies.get('tec_refresh_token')?.value,
    },
  }));
  return NextResponse.json({ ok: true });
}
