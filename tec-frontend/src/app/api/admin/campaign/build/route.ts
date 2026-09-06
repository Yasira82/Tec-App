import { NextRequest, NextResponse } from 'next/server';

/**
 * Which build is actually serving this request.
 *
 * The question behind half of "it is still broken" is "did it deploy?", and
 * until now the only way to answer it was to go and read the Vercel dashboard.
 * A merge is not a deploy, and testing a fix that is not live yet costs an hour
 * every time it happens.
 *
 * Vercel sets these at BUILD time. They are the commit the running bundle was
 * built from — not `main`, and not what a browser cached.
 *
 * Session-gated rather than admin-gated: a commit sha is not a secret (the
 * repository behind it is private, and knowing the sha grants nothing), and the
 * whole value of this route is being able to answer "is the fix live" without
 * first getting past something that might itself be the thing that is broken.
 */
export async function GET(req: NextRequest) {
  if (!req.cookies.get('tec_access_token')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  return NextResponse.json({
    commit:  sha ? sha.slice(0, 7) : 'unknown',
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
    branch:  process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env:     process.env.VERCEL_ENV ?? 'local',
    // Not a build stamp — the moment this instance started. Two different
    // answers from two taps means more than one instance is serving, which is
    // its own explanation for "it worked, then it did not".
    startedAt: START,
    now:       new Date().toISOString(),
  });
}

const START = new Date().toISOString();
