/**
 * No Pi server key is ever written into this app's source.
 *
 * `/api/admin/clear-payment` shipped as a "TEMP one-off" with the Hub's Pi
 * server key as a string literal, and stayed deployed for three months. It
 * answered a plain GET with no session and no role check, so anyone could read
 * any Hub payment by id, or ask Pi to complete one, under the Hub's own key.
 * CSRF did not cover it: the middleware checks unsafe methods only.
 *
 * The key belongs in `PI_API_KEY` on the server, where payment-service reads
 * it. A literal in the source is a key in every clone and every fork, forever
 * — deleting the file does not delete it from history.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      yield* sources(p);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
      yield p;
    }
  }
}

describe('Pi server keys live in the environment, never in source', () => {
  const files = [...sources(ROOT)];

  it('finds the source tree it is guarding', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no `Key <secret>` Authorization literal', () => {
    const hits = files.filter((f) => /Key [a-z0-9]{40,}/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('assigns PI_API_KEY only from process.env', () => {
    const hits = files.filter((f) =>
      /PI_API_KEY[A-Z_]*\s*=\s*['"`][A-Za-z0-9]{20,}/.test(readFileSync(f, 'utf8')),
    );
    expect(hits).toEqual([]);
  });

  it('keeps the one-off route that carried the Hub key deleted', () => {
    expect(files.some((f) => f.includes(join('api', 'admin', 'clear-payment')))).toBe(false);
  });
});
