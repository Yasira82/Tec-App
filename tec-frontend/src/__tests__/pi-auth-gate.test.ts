//
// Pi Browser breaks on CONCURRENT Pi.authenticate calls. The Hub had two
// independent callers and nothing connecting them:
//
//   pi-auth.ts  loginWithPi()  → its own Pi.authenticate, 45s budget
//   pi-session  _doAuth()      → the payment modal's,      25s budget
//
// When they overlapped the loser was never answered — no error, no rejection —
// and died on its own timer. The modal reported `Pi auth (TIMEOUT): TIMEOUT`,
// which is true and says nothing about the cause.
//
// It only ever showed on the paired Testnet host, for a reason unrelated to
// payments: hub.tecosystem.app already holds a session, so login does not run
// there. The Testnet host is a different origin with its own cookies, so login
// runs on arrival — exactly when a Mode-1 modal opens. Same code, opposite
// outcome, decided by whether a cookie happened to exist.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { piSession } from '@/lib-client/pi/pi-session';

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('the authenticate gate', () => {
  beforeEach(() => { piSession.reset(); });

  it('never lets two calls overlap — the second waits', async () => {
    // This is the whole defect in one assertion: with the two call sites
    // unconnected, `peak` reached 2 and Pi answered neither reliably.
    let live = 0;
    let peak = 0;
    const first  = deferred<string>();
    const second = deferred<string>();

    const run = (d: typeof first) => piSession.withAuthGate(async () => {
      live += 1;
      peak = Math.max(peak, live);
      try { return await d.promise; } finally { live -= 1; }
    });

    const a = run(first);
    const b = run(second);

    // Let the microtask queue settle: if the gate were absent, both bodies
    // would have started by now.
    await Promise.resolve();
    await Promise.resolve();
    expect(peak).toBe(1);

    first.resolve('login');
    await a;
    // Only now may the second body start.
    await Promise.resolve();
    second.resolve('modal');

    await expect(b).resolves.toBe('modal');
    expect(peak).toBe(1);
  });

  it('runs them in the order they arrived', async () => {
    const order: string[] = [];
    const mk = (name: string, ms: number) => piSession.withAuthGate(async () => {
      await new Promise(r => setTimeout(r, ms));
      order.push(name);
      return name;
    });

    vi.useFakeTimers();
    const p1 = mk('login', 50);
    const p2 = mk('modal', 1);   // shorter, but queued second
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);
    vi.useRealTimers();

    expect(order).toEqual(['login', 'modal']);
  });

  it("a failed holder releases the gate — it never fails the next caller", async () => {
    // The gate serializes; it must never cancel or reject on someone else's
    // behalf. A login that times out must not take the payment down with it.
    const boom = piSession.withAuthGate(async () => { throw new Error('AUTH_TIMEOUT'); });
    await expect(boom).rejects.toThrow('AUTH_TIMEOUT');

    await expect(piSession.withAuthGate(async () => 'ok')).resolves.toBe('ok');
  });

  it('is released even when the holder never settles cleanly, so it cannot deadlock', async () => {
    const d = deferred<string>();
    const held = piSession.withAuthGate(() => d.promise);
    const queued = piSession.withAuthGate(async () => 'after');

    d.reject(new Error('rejected'));
    await expect(held).rejects.toThrow('rejected');
    await expect(queued).resolves.toBe('after');
  });
});

describe('both call sites go through the gate', () => {
  const read = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf8');

  it('login authenticates through it', () => {
    // A new `window.Pi.authenticate(` outside the gate re-opens the bug, and
    // the symptom is a 25s silence with no error anywhere — so it is pinned
    // here rather than left to review.
    const auth = read('src/lib-client/pi/pi-auth.ts');
    expect(auth).toContain('piSession.withAuthGate(');
    const callLine = auth.split('\n').findIndex(l => l.includes('window.Pi.authenticate('));
    const gateLine = auth.split('\n').findIndex(l => l.includes('piSession.withAuthGate('));
    expect(gateLine).toBeGreaterThan(-1);
    expect(gateLine).toBeLessThan(callLine);
  });

  it('the payment modal authenticates through it', () => {
    const session = read('src/lib-client/pi/pi-session.ts');
    const lines   = session.split('\n');
    const gate    = lines.findIndex(l => l.includes('await this.withAuthGate('));
    const call    = lines.findIndex(l => l.includes('Pi.authenticate('));
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(call);
  });

  it('has exactly these two authenticate call sites', () => {
    // pi-test is the diagnostics page and calls Pi directly ON PURPOSE — that
    // is what made it the control that proved the SDK itself was healthy
    // (0.6s, no unfinished payment) while the modal timed out.
    const walk = (d: string): string[] =>
      require('node:fs').readdirSync(d, { withFileTypes: true }).flatMap(
        (e: { name: string; isDirectory(): boolean }) =>
          e.isDirectory() ? walk(require('node:path').join(d, e.name))
                          : [require('node:path').join(d, e.name)]);

    const offenders = walk(require('node:path').join(process.cwd(), 'src'))
      .filter((f: string) => /\.tsx?$/.test(f) && !f.includes('__tests__')
        && !f.includes('pi-test') && !f.endsWith('pi-auth.ts') && !f.endsWith('pi-session.ts'))
      .filter((f: string) => read(f.replace(`${process.cwd()}/`, ''))
        .split('\n')
        .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .some(l => /\bPi[!.]?\.authenticate\s*\(/.test(l) || /window\.Pi\W*\.authenticate\(/.test(l)));

    expect(offenders.map((f: string) => f.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });
});
