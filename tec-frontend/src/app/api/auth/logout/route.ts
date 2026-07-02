import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });

  // Deletion attributes MUST match how the cookies were set (none+secure+
  // partitioned) — an attribute-mismatched clearing cookie targets a different
  // cookie jar (especially with Partitioned) and silently fails to delete.
  const gone = { maxAge: 0, path: '/', secure: true, sameSite: 'none' as const, partitioned: true };
  res.cookies.set('tec_access_token',  '', gone);
  res.cookies.set('tec_refresh_token', '', { ...gone, httpOnly: true });
  res.cookies.set('tec_user',          '', gone);
  // ✅ P2-2: امسح الـ CSRF cookie كمان
  res.cookies.set('tec_csrf',          '', gone);

  return res;
}
