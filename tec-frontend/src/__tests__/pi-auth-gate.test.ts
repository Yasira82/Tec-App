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

// ── One authenticate, not two ───────────────────────────────────────────────
// `loginWithPi` authenticates with the SAME scopes and succeeds, but the
// session manager knew nothing about it — so the first Pay tap ran a SECOND,
// redundant Pi.authenticate. With the gate in place that call queues behind
// login's, and the modal's budget (25s) is shorter than login's (45s), so the
// modal could spend its whole budget waiting for a session it already had.
//
// Measured in production: `tap: authenticating` at 1.4s, `auth FAILED TIMEOUT`
// at 24.5s — and the very next attempt succeeding instantly. "It works if you
// try again in a minute" was exactly that: the retry found `authenticated`
// already true and never called Pi at all.
describe('a login is adopted, not repeated', () => {
  beforeEach(() => { piSession.reset(); });

  it('marks the session authenticated with the payments scope', () => {
    expect(piSession.isAuthenticated).toBe(false);
    piSession.markAuthenticated();
    expect(piSession.isAuthenticated).toBe(true);
    expect(piSession.hasScope).toBe(true);
    expect(piSession.lastError).toBeNull();
  });

  it('lets ensureAuth return without calling Pi again', async () => {
    // The whole point: after login, the first tap must not authenticate.
    // `authenticate` is a throwing stub — reaching it fails this test loudly.
    const w = window as unknown as Record<string, unknown>;
    w.__TEC_PI_READY = true;
    w.Pi = { authenticate: () => { throw new Error('must not authenticate again'); } };

    piSession.markAuthenticated();
    await expect(piSession.ensureAuth()).resolves.toBe(true);

    delete w.Pi;
    delete w.__TEC_PI_READY;
  });

  it('still re-authenticates if the SDK went away — adoption is not a bypass', async () => {
    // The drift guard must keep working: a marked session with no live SDK is
    // stale, not valid. Adoption records a real login; it does not grant one.
    const w = window as unknown as Record<string, unknown>;
    w.__TEC_PI_READY = true;
    piSession.markAuthenticated();
    delete w.Pi;                       // SDK gone
    await expect(piSession.ensureAuth()).resolves.toBe(false);
    expect(piSession.isAuthenticated).toBe(false);
    delete w.__TEC_PI_READY;
  });

  it('reset() clears it — a logout must not leave a live session behind', async () => {
    piSession.markAuthenticated();
    piSession.reset();
    expect(piSession.isAuthenticated).toBe(false);
    expect(piSession.hasScope).toBe(false);
  });

  it('login calls it on success and ONLY on success', () => {
    const auth = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/lib-client/pi/pi-auth.ts'), 'utf8');
    const lines: string[] = auth.split('\n');
    const mark   = lines.findIndex(l => l.includes('piSession.markAuthenticated()'));
    const thenAt = lines.findIndex(l => l.includes('.then(result => {'));
    const catchAt = lines.findIndex(l => l.includes('.catch(err'));
    expect(mark).toBeGreaterThan(thenAt);   // inside the success handler
    expect(mark).toBeLessThan(catchAt);     // and never in the failure one
  });
});

// ── The tap JOINS the warm-up; it never restarts it ─────────────────────────
// Read straight off a production trace, with the modal still spinning:
//
//   0.0s SDK ready — warming the Pi session
//   1.2s tap: warm-up still running — starting a fresh authenticate
//   1.2s tap: authenticating          … and then nothing, for a minute
//
// The tap threw away a healthy 1.2-second-old handshake and issued a second
// one. Pi's bridge still held the first, so that is two concurrent
// Pi.authenticate calls — the exact failure the gate exists to prevent,
// produced by the code written to avoid it (a stalled warm-up "can never be
// inherited"). A stalled one cannot be inherited forever anyway: _doAuth
// carries its own budget and settles, and the gate then runs the next attempt
// SEQUENTIALLY, which is the only safe way to run two of these.
describe('the payment tap does not restart an in-flight handshake', () => {
  const read = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf8');

  it('never calls piSession.reset() inside handlePay', () => {
    // Scoped to the tap. The "Try Again" button DOES reset — it is clearing a
    // session that already failed, with no call in flight, which is the
    // opposite situation.
    const modal: string = read('src/app/hub/components/PaymentModal.tsx');
    const lines: string[] = modal.split('\n');
    const start = lines.findIndex(l => l.includes('const handlePay'));
    const end   = lines.findIndex((l, i) => i > start && l.startsWith('  }, ['));
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const body = lines.slice(start, end).filter(l =>
      !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    expect(body.some(l => /piSession\.reset\(\)/.test(l))).toBe(false);
  });

  it('still distinguishes the three cases in the trace', () => {
    // Joining must stay VISIBLE: the next trace has to say which of the three
    // happened, or the next reader is back to guessing.
    const modal = read('src/app/hub/components/PaymentModal.tsx');
    expect(modal).toContain('tap: session ready');
    expect(modal).toContain('tap: joining the warm-up already in flight');
    expect(modal).toContain('tap: authenticating');
  });
});
