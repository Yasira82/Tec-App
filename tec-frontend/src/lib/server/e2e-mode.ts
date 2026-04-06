import { NextResponse } from 'next/server';

/**
 * Returns true when running in E2E test mode (no external network calls should be made).
 * Checks E2E_MODE env, NEXT_PUBLIC_E2E_MODE, or CI conservative fallback.
 */
export function isE2eMode(): boolean {
  return (
    process.env.E2E_MODE === 'true' ||
    process.env.NEXT_PUBLIC_E2E_MODE === 'true' ||
    (process.env.CI === 'true' && process.env.E2E_ALLOW_NETWORK !== 'true')
  );
}

/**
 * Returns a fast deterministic stub response for E2E mode.
 * @param status HTTP status code
 * @param extra  Additional fields merged into the response body
 */
export function e2eStub(status: number, extra?: Record<string, unknown>): NextResponse {
  const success = status >= 200 && status < 300;
  return NextResponse.json(
    { success, error: success ? undefined : 'e2e-stub', ...extra },
    { status },
  );
}
