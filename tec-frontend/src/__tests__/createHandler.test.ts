import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import {
  createHandler,
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/bff/createHandler';

// ── JWT mock ──────────────────────────────────────────────────
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));
import { jwtVerify } from 'jose';

const mockJwtVerify = vi.mocked(jwtVerify);

// ── NextRequest factory ───────────────────────────────────────
const makeReq = (opts: {
  token?: string;
  body?: unknown;
  method?: string;
} = {}): NextRequest => ({
  cookies:  { get: (n: string) => n === 'tec_access_token' && opts.token ? { value: opts.token } : undefined },
  headers:  { get: () => null },
  method:   opts.method ?? 'POST',
  nextUrl:  { pathname: '/api/test' },
  json:     async () => opts.body ?? {},
} as unknown as NextRequest);

beforeAll(() => { process.env.JWT_SECRET = 'test-secret-32-chars-long-for-hs256'; });
afterAll(()  => { delete process.env.JWT_SECRET; });

// ── Error classes ──────────────────────────────────────────────
describe('Error classes', () => {
  it('AppError has correct defaults', () => {
    const e = new AppError('oops');
    expect(e.message).toBe('oops');
    expect(e.status).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
    expect(e.name).toBe('AppError');
  });

  it('UnauthorizedError has status 401', () => {
    const e = new UnauthorizedError();
    expect(e.status).toBe(401);
    expect(e.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError has status 403', () => {
    const e = new ForbiddenError();
    expect(e.status).toBe(403);
    expect(e.code).toBe('FORBIDDEN');
  });

  it('NotFoundError has status 404 and resource name', () => {
    const e = new NotFoundError('Widget');
    expect(e.status).toBe(404);
    expect(e.message).toContain('Widget');
    expect(e.code).toBe('NOT_FOUND');
  });
});

// ── No auth required ─────────────────────────────────────────
describe('createHandler — requireAuth: false', () => {
  it('executes handler without token', async () => {
    const handler = createHandler({
      requireAuth: false,
      handler: async () => ({ ok: true }),
    });
    const res  = await handler(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

// ── Auth required ────────────────────────────────────────────
describe('createHandler — auth required', () => {
  it('returns 401 when no token cookie', async () => {
    const handler = createHandler({ handler: async () => ({}) });
    const res  = await handler(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when jwtVerify throws', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('bad sig'));
    const handler = createHandler({ handler: async () => ({}) });
    const res = await handler(makeReq({ token: 'bad.jwt.token' }));
    expect(res.status).toBe(401);
  });

  it('executes handler with valid JWT', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-123', kycVerified: true },
    } as any);
    const captured: string[] = [];
    const handler = createHandler({
      handler: async ({ ctx }) => { captured.push(ctx.userId); return { userId: ctx.userId }; },
    });
    const res  = await handler(makeReq({ token: 'valid.jwt.token' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.userId).toBe('user-123');
    expect(captured[0]).toBe('user-123');
  });
});

// ── KYC guard ────────────────────────────────────────────────
describe('createHandler — requireKYC', () => {
  it('returns 403 when kycVerified is false', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u1', kycVerified: false } } as any);
    const handler = createHandler({ requireKYC: true, handler: async () => ({}) });
    const res = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('passes KYC guard when kycVerified is true', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u1', kycVerified: true } } as any);
    const handler = createHandler({ requireKYC: true, handler: async () => ({ passed: true }) });
    const res = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passed).toBe(true);
  });
});

// ── Zod validation ───────────────────────────────────────────
describe('createHandler — Zod schema', () => {
  const schema = z.object({ name: z.string() });

  it('returns 400 on Zod validation failure', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const handler = createHandler({
      schema,
      handler: async () => ({}),
    });
    const res  = await handler(makeReq({ token: 'tok', body: { name: 123 } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details).toBeDefined();
  });

  it('passes validated input to handler', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const captured: string[] = [];
    const handler = createHandler({
      schema,
      handler: async ({ input }) => { captured.push((input as { name: string }).name); return {}; },
    });
    const res = await handler(makeReq({ token: 'tok', body: { name: 'Alice' } }));
    expect(res.status).toBe(200);
    expect(captured[0]).toBe('Alice');
  });
});

// ── AppError ─────────────────────────────────────────────────
describe('createHandler — AppError propagation', () => {
  it('returns correct status from AppError', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const handler = createHandler({
      handler: async () => { throw new AppError('not valid', 422, 'UNPROCESSABLE'); },
    });
    const res  = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('UNPROCESSABLE');
    expect(body.message).toBe('not valid');
  });
});

// ── Upstream status pass-through ─────────────────────────────
/**
 * The bug these pin: a notification-service whose INTERNAL_SECRET had drifted
 * from the gateway's answered 403, and this handler reported 500 — the same code
 * a gateway that cannot reach the service at all produces. Two unrelated causes,
 * one number on the screen.
 */
describe('createHandler — upstream status reaches the caller', () => {
  it('passes a 4xx through WITH its message — it is a sentence for a person', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const handler = createHandler({
      handler: async () => {
        throw Object.assign(new Error('Gateway 403'), { status: 403 });
      },
    });
    const res  = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('UPSTREAM_REFUSED');
    expect(body.message).toBe('Gateway 403');
  });

  /**
   * A 5xx keeps the generic 500 — deliberately, and NOT changed here.
   * `createHandler.errors.test.ts` pins that an upstream 5xx's text can name
   * hosts, drivers and stack frames, so it must never reach a caller. Passing
   * its STATUS through while keeping the text generic was written and then
   * backed out: it would have overridden a decision another test was guarding,
   * to win a distinction the 403 below already provides.
   */
  it('still reports an unreachable upstream as a plain 500', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const handler = createHandler({
      handler: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.4:5006'), { status: 502 });
      },
    });
    const res  = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('tells a REFUSAL apart from an unreachable upstream — the whole point', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const mk = (status: number) => createHandler({
      handler: async () => { throw Object.assign(new Error(`Gateway ${status}`), { status }); },
    });
    const refused     = await mk(403)(makeReq({ token: 'tok' }));  // key mismatch → 403
    const unreachable = await mk(502)(makeReq({ token: 'tok' }));  // cannot connect → 500
    expect(refused.status).toBe(403);
    expect(unreachable.status).toBe(500);
    expect(refused.status).not.toBe(unreachable.status);
  });
});

// ── Unknown error ────────────────────────────────────────────
describe('createHandler — unknown error', () => {
  it('returns 500 on unexpected throw', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } } as any);
    const handler = createHandler({
      handler: async () => { throw new Error('boom'); },
    });
    const res  = await handler(makeReq({ token: 'tok' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
  });
});

// ── X-Request-Id header ──────────────────────────────────────
describe('createHandler — response headers', () => {
  it('includes X-Request-Id in response', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1', kycVerified: false } } as any);
    const handler = createHandler({ requireAuth: false, handler: async () => ({}) });
    const res = await handler(makeReq());
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });
});
