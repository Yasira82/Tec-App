/**
 * The owner's phone, 2026-10-08: Settings said "Goals ✓ shared · 1", TEC AI said it could
 * not see any goals; Android's back over TEC AI left /hub for "Sign in with Pi".
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useBackCloses } from '@/lib-client/back-closes';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const route = read('src/app/api/ai/chat/route.ts');
const hook  = read('src/lib-client/hooks/useAiChat.ts');

describe('goals Settings shows as shared reach the chat', () => {
  it('a completed goal is still named — it no longer reads as "NONE shared"', () => {
    expect(route).toMatch(/const done\s+= \(userContext\?\.goals \?\? \[\]\)\.filter\(g => g\.done\)/);
    expect(route).toMatch(/- Completed goals: /);
    expect(route).toMatch(/goals\.length \|\| done\.length \|\| userContext\?\.contextMissing/);
  });

  it('a context that did not arrive is told to the model as a loading problem, not as "none shared"', () => {
    expect(route).toMatch(/contextMissing: !claims/);
    expect(route).toMatch(/Never say they shared none/);
  });

  it('the message waits longer than the BFF\'s own reads, and an old or empty context is read again', () => {
    const wait = Number(hook.match(/const CONTEXT_WAIT_MS = (\d+)/)?.[1]);
    expect(wait).toBeGreaterThan(2500);   // the BFF gives Life and Analytics 2.5 s each
    const fresh = hook.match(/const CONTEXT_FRESH_MS = ([\d *]+);/)?.[1] ?? '';
    expect(fresh).toBe('10 * 60 * 1000');   // under the token's 15 minutes
    expect(hook).toMatch(/Date\.now\(\) - held\.at < CONTEXT_FRESH_MS \? held\.p : loadContext\(\)/);
    expect(hook).toMatch(/contextToken && ctxRef\.current\?\.p === p\) ctxRef\.current = null/);
  });
});

describe('back closes TEC AI instead of leaving the Hub', () => {
  it('opening pushes one entry; back closes the sheet and does not go back again', () => {
    const onClose = vi.fn();
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { rerender } = renderHook(({ open }) => useBackCloses(open, onClose), { initialProps: { open: true } });
    expect(push).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender({ open: false });
    expect(back).not.toHaveBeenCalled();
    push.mockRestore(); back.mockRestore();
  });

  it('closed with ✕, its entry is taken off so the next back is not wasted', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { rerender } = renderHook(({ open }) => useBackCloses(open, () => {}), { initialProps: { open: true } });
    rerender({ open: false });
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('the Hub drawer uses it', () => {
    expect(read('src/app/hub/components/AIDrawer.tsx')).toMatch(/useBackCloses\(open, onClose\)/);
  });
});
