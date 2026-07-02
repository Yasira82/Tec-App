import { NextResponse } from 'next/server';

// Backend keep-warm probe. Railway services sleep after idle; the first real
// request then eats the cold start (5xx/504 or seconds of latency — July 2026
// logs). Every entry page fires this fire-and-forget on mount, so the backend
// wakes DURING login/navigation instead of in front of the user's data.
// Always 200 — a warmup must never surface an error.
export async function GET() {
  const gateway = process.env.API_GATEWAY_URL ?? '';
  if (gateway) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      await fetch(`${gateway}/health`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
    } catch { /* cold start in progress — that IS the point */ }
  }
  return NextResponse.json({ ok: true });
}
