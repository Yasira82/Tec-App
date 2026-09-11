import { NextResponse } from 'next/server';

// Which commit this DEPLOYMENT serves. Pair it with the client bundle's own
// `NEXT_PUBLIC_BUILD_SHA` (shown on /pi-test): if the two disagree, the browser
// is holding a cached bundle; if both are older than main, the deploy is stale.
// Either answer ends the "did it actually ship?" argument in one request.
const BUILD_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);

export async function GET() {
  const gatewayUrl = process.env.API_GATEWAY_URL ?? '';

  if (!gatewayUrl) {
    return NextResponse.json({ online: false, buildSha: BUILD_SHA, error: 'not configured' });
  }

  try {
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: AbortSignal.timeout(10000), // align with gateway proxyTimeout=10s — no 499 ghost-aborts
    });

    if (!res.ok) {
      return NextResponse.json({ online: false, buildSha: BUILD_SHA, error: `status ${res.status}` });
    }

    const data = await res.json();
    return NextResponse.json({ online: true, buildSha: BUILD_SHA, ...data });
  } catch (err) {
    return NextResponse.json({
      online:   false,
      buildSha: BUILD_SHA,
      error:    err instanceof Error ? err.message : 'Failed to reach gateway',
    });
  }
}
