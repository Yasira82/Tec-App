import { NextRequest, NextResponse } from 'next/server';

/**
 * Passive middleware inside src/.
 * Kept so any older imports/tests referencing this path won't fail.
 * It matches nothing, so it will not run.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
