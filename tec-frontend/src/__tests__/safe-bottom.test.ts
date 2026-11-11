import { describe, it, expect } from 'vitest';
import { safeBottomFallback, SAFE_BOTTOM_BOOT_SCRIPT, ANDROID_NAV_FALLBACK_PX } from '@/lib-client/safe-bottom';

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36';
const IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('safe-bottom: room under the bottom bar when the browser reports none', () => {
  it('Android with no reported inset reserves the three-button bar', () => {
    expect(safeBottomFallback(ANDROID, 0)).toBe(ANDROID_NAV_FALLBACK_PX);
    expect(safeBottomFallback(ANDROID, NaN)).toBe(ANDROID_NAV_FALLBACK_PX);
  });

  it('a reported inset wins — nothing is added on top of it', () => {
    expect(safeBottomFallback(ANDROID, 24)).toBe(0);
  });

  it('iOS and desktop are untouched', () => {
    expect(safeBottomFallback(IPHONE, 0)).toBe(0);
    expect(safeBottomFallback('Mozilla/5.0 (X11; Linux x86_64)', 0)).toBe(0);
  });

  it('the boot script sets the same value the decision returns, and never throws', () => {
    expect(SAFE_BOTTOM_BOOT_SCRIPT).toContain(`'--tec-safe-bottom-fallback','${ANDROID_NAV_FALLBACK_PX}px'`);
    expect(SAFE_BOTTOM_BOOT_SCRIPT).toMatch(/try\{[\s\S]*\}catch\(e\)\{\}/);
    // runs as a string in <head>: must parse on its own
    expect(() => new Function(SAFE_BOTTOM_BOOT_SCRIPT)).not.toThrow();
  });
});
