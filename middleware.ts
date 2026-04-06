import { NextRequest, NextResponse } from 'next/server';

/**
 * Passive root middleware.
 * Kept to avoid CI/E2E failures if tests expect this file to exist.
 * It matches nothing, so it will not run in production.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
