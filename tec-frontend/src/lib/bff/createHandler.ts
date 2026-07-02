import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ══════════════════════════════════════════════════════════════
//  BFF Handler Factory — v3
//  JWT cookie auth + KYC guard + Zod + structured errors
// ══════════════════════════════════════════════════════════════

// ─── Error Model ─────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code   = 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor() { super('Unauthorized', 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404, 'NOT_FOUND'); }
}

// ─── Context ──────────────────────────────────────────────────

export interface BFFContext {
  userId:      string;
  kycVerified: boolean;
  requestId:   string;
}

// ─── Auth Extractor ───────────────────────────────────────────

class TokenExpiredError extends AppError {
  constructor() { super('Token expired', 401, 'TOKEN_EXPIRED'); }
}

async function contextFromToken(token: string, req: NextRequest): Promise<BFFContext> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  try {
    const encoded       = new TextEncoder().encode(secret);
    const { payload }   = await jwtVerify(token, encoded, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub;
    if (!userId) throw new UnauthorizedError();

    return {
      userId,
      kycVerified: (payload as Record<string, unknown>).kycVerified === true,
      requestId:   req.headers.get('x-request-id') ?? crypto.randomUUID(),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Expired is recoverable (server-side refresh below); anything else is not.
    if ((err as { code?: string })?.code === 'ERR_JWT_EXPIRED') throw new TokenExpiredError();
    throw new UnauthorizedError();
  }
}

async function extractContext(req: NextRequest): Promise<BFFContext> {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) throw new UnauthorizedError();
  return contextFromToken(token, req);
}

// ─── Server-side token refresh ────────────────────────────────
// The access token lives ~1h and the backend rotates refresh tokens
// (single-use). Refreshing from the BROWSER proved fragile in Pi Browser
// (the rotated cookie didn't persist → "Refresh token already used" → dead
// session). So the BFF refreshes HERE: gateway refresh → run the handler with
// the new token → set the rotated cookies on THIS response, which the browser
// stores because it accompanies a normal same-origin request.

interface RefreshedTokens { token: string; refreshToken: string | null }

// Single-flight per refresh-token value: the Hub fires several BFF calls at
// once on mount; without this, each would race to consume the SAME single-use
// refresh token and all but one would burn as "Refresh token already used".
const inflightRefresh = new Map<string, Promise<RefreshedTokens | null>>();

async function refreshAtGateway(req: NextRequest): Promise<RefreshedTokens | null> {
  const refresh = req.cookies.get('tec_refresh_token')?.value;
  const gateway = process.env.API_GATEWAY_URL ?? '';
  if (!refresh || !gateway) return null;

  const existing = inflightRefresh.get(refresh);
  if (existing) return existing;

  const attempt = (async (): Promise<RefreshedTokens | null> => {
    try {
      const res = await fetch(`${gateway}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refresh}` },
        cache:   'no-store',
      });
      if (!res.ok) return null;

      const data  = await res.json().catch(() => ({}));
      const token = data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken ?? null;
      if (!token) return null;

      return { token, refreshToken: data.refreshToken ?? data.data?.refreshToken ?? null };
    } catch {
      return null;
    }
  })();

  inflightRefresh.set(refresh, attempt);
  // Keep the resolved promise for 5s so stragglers reuse the result instead of
  // re-consuming the (now rotated) token, then clean up.
  attempt.finally(() => { setTimeout(() => inflightRefresh.delete(refresh), 5000); });
  return attempt;
}

// sameSite:'none' — matches pi-login/refresh (embedded Pi Browser rejects 'lax').
function setRefreshedCookies(res: NextResponse, refreshed: RefreshedTokens): void {
  const base = { secure: true, sameSite: 'none' as const, partitioned: true, path: '/' };
  res.cookies.set('tec_access_token', refreshed.token, {
    ...base, httpOnly: false, maxAge: 60 * 60 * 24,
  });
  if (refreshed.refreshToken) {
    res.cookies.set('tec_refresh_token', refreshed.refreshToken, {
      ...base, httpOnly: true, maxAge: 60 * 60 * 24 * 7,
    });
  }
}

// ─── Handler Config ───────────────────────────────────────────

export interface HandlerConfig<TInput, TOutput> {
  schema?:      z.ZodSchema<TInput>;
  requireAuth?: boolean;  // default: true
  requireKYC?:  boolean;  // default: false
  handler: (args: {
    input: TInput;
    ctx:   BFFContext;
    req:   NextRequest;
  }) => Promise<TOutput>;
}

// ─── Factory ──────────────────────────────────────────────────

export function createHandler<TInput = Record<string, never>, TOutput = unknown>(
  config: HandlerConfig<TInput, TOutput>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const startMs = Date.now();
    let ctx: BFFContext = { userId: 'anonymous', kycVerified: false, requestId: crypto.randomUUID() };

    // Set when the access token expired and the gateway gave us a new pair;
    // every response path below must carry these cookies back to the browser.
    let refreshed: RefreshedTokens | null = null;
    const respond = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response => {
      const res = NextResponse.json(body, init);
      if (refreshed) setRefreshedCookies(res, refreshed);
      return res;
    };

    try {
      // 1) Auth — expired token → refresh at the gateway and continue
      if (config.requireAuth !== false) {
        try {
          ctx = await extractContext(req);
        } catch (authErr) {
          if (!(authErr instanceof TokenExpiredError)) throw authErr;
          refreshed = await refreshAtGateway(req);
          if (!refreshed) throw authErr; // no refresh possible → 401 TOKEN_EXPIRED
          ctx = await contextFromToken(refreshed.token, req);
          // Handlers read the token from req.cookies — give them the fresh one.
          req.cookies.set('tec_access_token', refreshed.token);
        }
      }

      // 2) KYC guard
      if (config.requireKYC && !ctx.kycVerified) {
        throw new ForbiddenError('KYC_REQUIRED');
      }

      // 3) Parse + validate body
      let input: TInput = {} as TInput;
      if (config.schema) {
        let body: unknown = {};
        try { body = await req.json(); } catch { /* empty body ok */ }
        input = config.schema.parse(body);
      }

      // 4) Execute handler
      const result = await config.handler({ input, ctx, req });

      // 5) Log success
      console.info('[BFF]', {
        path:      req.nextUrl.pathname,
        method:    req.method,
        userId:    ctx.userId,
        requestId: ctx.requestId,
        ms:        Date.now() - startMs,
        status:    200,
      });

      return respond(result, {
        headers: { 'X-Request-Id': ctx.requestId },
      });

    } catch (err) {
      // Zod validation error
      if (err instanceof z.ZodError) {
        console.warn('[BFF] Validation error', {
          path:      req.nextUrl.pathname,
          requestId: ctx.requestId,
          errors:    err.flatten(),
        });
        return respond(
          { error: 'VALIDATION_ERROR', details: err.flatten() },
          { status: 400, headers: { 'X-Request-Id': ctx.requestId } },
        );
      }

      // Known app error
      if (err instanceof AppError) {
        console.warn('[BFF] App error', {
          path:      req.nextUrl.pathname,
          requestId: ctx.requestId,
          code:      err.code,
          message:   err.message,
        });
        return respond(
          { error: err.code, message: err.message },
          { status: err.status, headers: { 'X-Request-Id': ctx.requestId } },
        );
      }

      // Unknown error
      console.error('[BFF] Unexpected error', {
        path:      req.nextUrl.pathname,
        requestId: ctx.requestId,
        err,
      });
      return respond(
        { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
        { status: 500, headers: { 'X-Request-Id': ctx.requestId } },
      );
    }
  };
}
