import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createHandler, AppError } from '../createHandler';

/**
 * What a caller is told when the handler throws.
 *
 * This is the layer between a service's refusal and a person reading a screen,
 * and it had a hole in exactly the place that matters: a route that re-threw an
 * upstream 409 as `Object.assign(new Error(message), { status })` — the obvious
 * shape, used by five routes — was not an `AppError`, so it fell through to the
 * unknown-error branch. The browser got **500 "Something went wrong"** and the
 * real sentence went only to the server log.
 *
 * Seen in production: a pioneer whose wallet had already claimed was told the
 * platform had crashed. The difference between those two messages is the
 * difference between knowing what to do and believing the app is broken.
 */

const post = (body: unknown = {}) =>
  new NextRequest('https://hub.tecosystem.app/api/bff/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const throwing = (err: unknown) =>
  createHandler({
    requireAuth: false,
    handler: async () => { throw err; },
  });

describe('an upstream refusal reaches the caller', () => {
  it('passes a 4xx status AND its message through', async () => {
    const res  = await throwing(
      Object.assign(new Error('This Pi wallet has already received a reward from this campaign.'), {
        status: 409,
      }),
    )(post());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toMatch(/already received a reward/);
  });

  it.each([400, 401, 403, 404, 409, 422])('carries %i unchanged', async (status) => {
    const res = await throwing(Object.assign(new Error('nope'), { status }))(post());
    expect(res.status).toBe(status);
  });

  it('still honours AppError, which was never the broken case', async () => {
    const res  = await throwing(new AppError('Bad input', 422, 'BAD_INPUT'))(post());
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body).toMatchObject({ error: 'BAD_INPUT', message: 'Bad input' });
  });
});

describe('what must NOT be passed through', () => {
  it('keeps a 5xx generic — that text can carry our internals', async () => {
    // An upstream 500 is not a sentence for a person; it is our failure, and
    // its body may name hosts, drivers or stack frames.
    const res  = await throwing(
      Object.assign(new Error('ECONNREFUSED 10.0.0.4:4004 prisma pool exhausted'), { status: 502 }),
    )(post());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toBe('Something went wrong');
    expect(JSON.stringify(body)).not.toMatch(/10\.0\.0\.4|prisma/);
  });

  it('keeps a plain Error generic — no status means no claim about one', async () => {
    const res  = await throwing(new Error('undefined is not a function'))(post());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.message).toBe('Something went wrong');
  });

  it('ignores a status that is not a number', async () => {
    // `status: '409'` from a JSON body would otherwise become a Response status
    // of a string, which is a different bug in a worse place.
    const res = await throwing(Object.assign(new Error('x'), { status: '409' }))(post());
    expect(res.status).toBe(500);
  });
});
