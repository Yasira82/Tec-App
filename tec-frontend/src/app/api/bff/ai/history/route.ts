import { z } from 'zod';
import { createHandler, AppError } from '@/lib/bff/createHandler';

/**
 * TEC AI conversations on the server — the signed-in person's own (C-104 §5.4).
 *
 * identity-service keeps them (`/identity/ai/conversations`, tec-core-backend
 * #411); the browser keeps a copy (lib/ai-session.ts) so the drawer paints at
 * once and still works if this is down. The person is the session's token, sent
 * as-is — this route names no user, and the service reads none from a body.
 *
 * GET  ?surface=      → { available, live, archives }   (available:false = use the device copy)
 * POST { action, … }  → save · archive · restore · delete · clear
 */

const Surface = z.enum(['tec_ai_drawer', 'tec_ai_page']);
const Turn    = z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(8000) });

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'),    surface: Surface, turns: z.array(Turn).max(40) }),
  z.object({ action: z.literal('archive'), surface: Surface }),
  z.object({ action: z.literal('restore'), surface: Surface, id: z.string().uuid() }),
  z.object({ action: z.literal('delete'),  id: z.string().uuid() }),
  z.object({ action: z.literal('clear'),   surface: Surface.optional() }),
]);
type ActionInput = z.infer<typeof Action>;

const BASE = '/api/identity/ai/conversations';

async function call(method: string, path: string, token: string, requestId: string, body?: unknown) {
  const gateway = process.env.API_GATEWAY_URL ?? '';
  if (!gateway) throw new AppError('Conversations are not configured', 503, 'NOT_CONFIGURED');
  const res = await fetch(`${gateway}${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'x-request-id':  requestId,
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    },
    body:   body === undefined ? undefined : JSON.stringify(body),
    cache:  'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => null) as { data?: unknown; message?: unknown } | null;
  if (!res.ok) {
    throw new AppError(typeof json?.message === 'string' ? json.message : `Conversations answered ${res.status}`, res.status, 'UPSTREAM');
  }
  return json?.data ?? null;
}

export const GET = createHandler<Record<string, never>, { available: boolean; live?: unknown; archives?: unknown }>({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const surface = Surface.safeParse(req.nextUrl.searchParams.get('surface'));
    if (!surface.success) throw new AppError('surface must be tec_ai_drawer or tec_ai_page', 400, 'VALIDATION_ERROR');
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    try {
      const data = await call('GET', `?surface=${surface.data}`, token, ctx.requestId) as { live?: unknown; archives?: unknown } | null;
      return { available: true, live: data?.live ?? null, archives: Array.isArray(data?.archives) ? data?.archives : [] };
    } catch (err) {
      // Not deployed yet, or down: the device copy carries on. Said, never hidden.
      console.warn('[BFF] ai history unavailable', { requestId: ctx.requestId, error: (err as Error).message });
      return { available: false };
    }
  },
});

export const POST = createHandler<ActionInput, unknown>({
  requireAuth: true,
  schema: Action,
  handler: async ({ input, ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    switch (input.action) {
      case 'save':    return call('PUT',    '/live',                     token, ctx.requestId, { surface: input.surface, turns: input.turns });
      case 'archive': return call('POST',   '/live/archive',             token, ctx.requestId, { surface: input.surface });
      case 'restore': return call('POST',   `/${input.id}/restore`,      token, ctx.requestId, { surface: input.surface });
      case 'delete':  return call('DELETE', `/${input.id}`,              token, ctx.requestId);
      case 'clear':   return call('DELETE', input.surface ? `?surface=${input.surface}` : '', token, ctx.requestId);
    }
  },
});
