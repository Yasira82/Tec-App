import { NextRequest, NextResponse } from 'next/server';

// Server-side session resolver. The frontend must NOT depend on reading
// document.cookie to know who is logged in — Pi Browser can store a cookie
// (so the server/middleware sees it) while hiding it from client JS, which made
// /hub bounce to login in an endless loop. The server can always read the
// request cookies, so usePiAuth falls back to this route when the client read
// fails. Fail closed: no/invalid session → 401.
export async function GET(req: NextRequest) {
  const token   = req.cookies.get('tec_access_token')?.value;
  const userRaw = req.cookies.get('tec_user')?.value;

  if (!token || token.trim() === '' || !userRaw) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  try {
    // req.cookies.get(...).value is already URL-decoded by Next, so this is
    // the raw JSON string we stored in pi-login / sso-callback.
    const user = JSON.parse(userRaw);
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
