'use client';

const KEY           = 'tec_pi_cb';
const FAILURE_LIMIT = 3;
const OPEN_TIMEOUT  = 60_000; // 60 s before allowing a retry (HALF_OPEN)

type CBState = {
  state:    'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  openedAt: number;
};

const DEFAULTS: CBState = { state: 'CLOSED', failures: 0, openedAt: 0 };

class PiCircuitBreaker {
  private read(): CBState {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as CBState) : DEFAULTS;
    } catch { return DEFAULTS; }
  }

  private write(s: CBState): void {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }

  get currentState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    const s = this.read();
    if (s.state === 'OPEN' && Date.now() - s.openedAt >= OPEN_TIMEOUT) {
      this.write({ ...s, state: 'HALF_OPEN' });
      return 'HALF_OPEN';
    }
    return s.state;
  }

  canAttempt(): boolean { return this.currentState !== 'OPEN'; }

  onSuccess(): void { this.write(DEFAULTS); }

  onFailure(): void {
    const s = this.read();
    const f = s.failures + 1;
    if (f >= FAILURE_LIMIT) {
      this.write({ state: 'OPEN', failures: f, openedAt: Date.now() });
    } else {
      this.write({ state: 'CLOSED', failures: f, openedAt: 0 });
    }
  }

  reset(): void { this.write(DEFAULTS); }

  stats(): { state: string; failures: number; secondsTillRecovery: number } {
    const s   = this.read();
    const msLeft = s.state === 'OPEN'
      ? Math.max(0, OPEN_TIMEOUT - (Date.now() - s.openedAt))
      : 0;
    return {
      state:               s.state,
      failures:            s.failures,
      secondsTillRecovery: Math.ceil(msLeft / 1000),
    };
  }
}

export const piCircuitBreaker = new PiCircuitBreaker();
