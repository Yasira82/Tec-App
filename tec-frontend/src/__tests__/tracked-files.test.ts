/**
 * Every source file these tests read must be TRACKED by git.
 *
 * `.gitignore` carried an unanchored `coverage/`, which matches a directory of
 * that name at any depth — and silently swallowed the API route
 * `src/app/api/admin/pioneers/coverage/route.ts`. `git add -A` said nothing.
 * The tests passed locally because the file was on disk. CI failed on a file it
 * had never been given, in a suite that had been green a minute earlier.
 *
 * A test that reads a file from disk cannot tell whether that file will exist
 * for anybody else. This one asks git.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/** Everything git actually knows about, as absolute paths. */
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((p) => join(ROOT, p)),
);

/** Every file under src/, ignoring nothing — this is the point. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('nothing under src/ is invisible to git', () => {
  it('has no untracked source file', () => {
    const missing = walk(join(ROOT, 'src'))
      .filter((f) => !tracked.has(f))
      .map((f) => relative(ROOT, f));

    // Named in the failure, so the fix is obvious rather than a hunt: an
    // ignore rule matched something it was never meant to.
    expect(missing).toEqual([]);
  });
});

describe('the ignore rule that caused it stays anchored', () => {
  const ignores = (p: string) => {
    try {
      execFileSync('git', ['check-ignore', '-q', p], { cwd: ROOT });
      return true;
    } catch {
      return false;
    }
  };

  it('does not ignore a source directory merely named "coverage"', () => {
    expect(ignores('src/app/api/admin/pioneers/coverage/route.ts')).toBe(false);
  });

  it('still ignores the coverage BUILD output at the package root', () => {
    // Anchoring must not turn into "stop ignoring coverage" — the report
    // directory is large, generated, and belongs nowhere near a commit.
    expect(ignores('coverage/index.html')).toBe(true);
  });
});
