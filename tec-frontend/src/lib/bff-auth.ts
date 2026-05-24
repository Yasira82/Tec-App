import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export interface BffAuthContext {
  accessToken: string;
  userId: string;
  csrfToken: string | null;
}

/**
 * Extracts and validates auth context from request cookies.
 * Returns context if valid, or a ready NextResponse (401/403) if not.
 *
 * Usage in any BFF route:
 *   const authResult = await extractBffAuth(req, { requireCsrf: true });
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { accessToken, userId } = authResult;
 */
export async function extractBffAuth(
  req: NextRequest,
  options: { requireCsrf?: boolean } = {},
): Promise<BffAuthContext | NextResponse> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get('tec_access_token')?.value;
  const userCookie = cookieStore.get('tec_user')?.value;
  const csrfCookie = cookieStore.get('tec_csrf')?.value;

  // 1. Auth check
  if (!accessToken || !userCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  // 2. Extract userId from tec_user cookie (JSON)
  let userId: string;
  try {
    const userJson: { id?: string } = JSON.parse(userCookie);
    if (!userJson?.id) throw new Error('Missing id');
    userId = userJson.id;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SESSION', message: 'Corrupted user cookie' } },
      { status: 401 },
    );
  }

  // 3. CSRF check (only for state-mutating routes)
  if (options.requireCsrf) {
    const csrfHeader = req.headers.get('x-csrf-token');
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_INVALID', message: 'CSRF token mismatch' } },
        { status: 403 },
      );
    }
  }

  return { accessToken, userId, csrfToken: csrfCookie ?? null };
}

/**
 * Type guard — use after extractBffAuth to narrow type safely.
 *
 * Example:
 *   const auth = await extractBffAuth(req, { requireCsrf: true });
 *   if (isBffAuthError(auth)) return auth;
 *   // auth is BffAuthContext here
 */
export function isBffAuthError(
  result: BffAuthContext | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
