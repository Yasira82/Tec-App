/**
 * Back from the Quest goes to the Hub — never into the app it was reached from.
 *
 * Seen on a phone, 2026-09-24: an app's "Back to the Quest" bar opens
 * `/pioneers` FORWARD, so Android's back from the Quest went into the app; its
 * bar pushed the Quest again; and the loop ended on the Hub's front page asking
 * a signed-in person to "Sign in with Pi".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useBackGoesToHub, __resetBackToHubForTests } from '@/lib-client/back-to-hub';

const replace = vi.fn();
let entryUrl = 'https://hub.tecosystem.app/pioneers';

beforeEach(() => {
  __resetBackToHubForTests();
  replace.mockReset();
  window.history.replaceState(null, '', '/pioneers');
  vi.spyOn(performance, 'getEntriesByType').mockImplementation(
    () => [{ name: entryUrl }] as unknown as PerformanceEntryList,
  );
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname: '/pioneers', href: 'https://hub.tecosystem.app/pioneers', replace },
    writable: true, configurable: true,
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); entryUrl = 'https://hub.tecosystem.app/pioneers'; });

// A pop lands on an entry: its state becomes history.state, then popstate fires.
const back = (state: unknown) => {
  window.history.replaceState(state, '');
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
};

describe('opened from OUTSIDE (an app bar, a link, a fresh context)', () => {
  it('pushes one guard entry', () => {
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useBackGoesToHub('/pioneers'));
    expect(push).toHaveBeenCalledOnce();
    expect((push.mock.calls[0]?.[0] as Record<string, unknown>).__tec_back_to_hub).toBe(true);
  });

  it('back off the guard goes to the Hub, replacing — not pushing', () => {
    renderHook(() => useBackGoesToHub('/pioneers'));
    back(null);
    expect(replace).toHaveBeenCalledWith('/hub');
  });

  it('pushes only once per document, however often the page remounts', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const a = renderHook(() => useBackGoesToHub('/pioneers'));
    a.unmount();
    renderHook(() => useBackGoesToHub('/pioneers'));
    expect(push).toHaveBeenCalledOnce();
  });

  it('ignores moving forward onto the guard', () => {
    renderHook(() => useBackGoesToHub('/pioneers'));
    back({ __tec_back_to_hub: true });
    expect(replace).not.toHaveBeenCalled();
  });

  it('ignores a pop that lands on another page (e.g. back from the FAQ is not ours)', () => {
    renderHook(() => useBackGoesToHub('/pioneers'));
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/hub', replace }, writable: true, configurable: true,
    });
    back(null);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('reached by navigating INSIDE the Hub', () => {
  it('leaves history alone — the Hub is already behind it, so back is right as it is', () => {
    entryUrl = 'https://hub.tecosystem.app/hub';
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useBackGoesToHub('/pioneers'));
    back(null);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('it is actually wired in', () => {
  // A guard nothing mounts is the same as no guard.
  const read = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'src', p), 'utf8') as string;

  it('on the Quest', () => {
    expect(read('app/pioneers/PioneersClient.tsx')).toContain("useBackGoesToHub('/pioneers')");
  });

  it('on the campaign', () => {
    expect(read('app/hub/campaign/page.tsx')).toContain("useBackGoesToHub('/hub/campaign')");
  });
});
