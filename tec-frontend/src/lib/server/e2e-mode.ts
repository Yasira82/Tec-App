import { NextResponse } from 'next/server';

/**
 * Returns true when the app is running in E2E test mode.
 *
 * Triggered by:
 *   - E2E_MODE=true          (explicit opt-in)
 *   - NEXT_PUBLIC_E2E_MODE=true  (client-visible variant)
 *
 * Conservative CI fallback: CI=true AND E2E_ALLOW_NETWORK != 'true'.
 */
export function isE2eMode(): boolean {
  if (process.env.E2E_MODE === 'true') return true;
  if (process.env.NEXT_PUBLIC_E2E_MODE === 'true') return true;
  if (process.env.CI === 'true' && process.env.E2E_ALLOW_NETWORK !== 'true') return true;
  return false;
}

/**
 * Returns a fast, deterministic JSON stub response for E2E mode.
 * Avoids any external network call to the Railway API Gateway.
 */
export function e2eStub(
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: 'Service stubbed in E2E test mode — external network is disabled', ...extra },
    { status },
  );
}
