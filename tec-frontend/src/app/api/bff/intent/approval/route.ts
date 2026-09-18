import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

/**
 * POST /api/bff/intent/approval — IIC 4.5 §7.
 *
 * Records that a human approved one step of a Nexus run, and WHAT THEY WERE LOOKING AT
 * when they did. The proof identity-service assembles is refused outright for a payment
 * step with no approval, so this route is the only thing standing between a governed
 * run and an unprovable one.
 *
 * ── `owner` comes from the verified token, never from the body ──────────────────
 *
 * The backend keys the run on the Pi username, so this route has to supply one. It is
 * taken from `ctx.piUsername` — a claim the auth service signed and `createHandler`
 * verified — rather than from the `tec_user` cookie or the request body. An approval
 * written against somebody else's run is not a permissions slip; it is forging the
 * signature the proof exists to carry. A token with no such claim is a 401 here rather
 * than a guess (P6): identity-service would have to invent an owner, and inventing the
 * principal in a record whose entire job is to name the principal is not a fallback.
 *
 * ── `shown` is passed through untouched ────────────────────────────────────────
 *
 * Not normalised, not trimmed beyond emptiness, not reformatted. It is the client's
 * account of its own screen, and a server that tidies it is a server that changed the
 * evidence. The honest limit is stated where the string is composed
 * (`lib-client/payment/shown.ts`): the HMAC protects it from being altered afterwards,
 * not from a client that lied at render time.
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    runId: z.string().min(1),
    step:  z.number().int().min(0),
    shown: z.string().min(1),
  }),
  handler: async ({ input, ctx, req }) => {
    if (!ctx.piUsername) {
      throw Object.assign(
        new Error('the session carries no Pi username — an approval cannot name its approver'),
        { status: 401 },
      );
    }

    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/identity/intent/runs/${encodeURIComponent(input.runId)}/approval`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'x-request-id':  ctx.requestId,
        },
        body: JSON.stringify({
          owner: ctx.piUsername,
          step:  input.step,
          shown: input.shown,
        }),
      },
    );

    if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
    return res.json();
  },
});
