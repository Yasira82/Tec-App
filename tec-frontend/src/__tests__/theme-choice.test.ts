/**
 * Light mode existed on paper for a long time: the token layer carried a
 * `[data-theme='light']` block and nothing anywhere set the attribute. These
 * assertions hold the missing half honest.
 *
 * The two that matter most are the ones that are easy to get subtly wrong:
 * "system" must NOT be resolved to a fixed value when it is applied (or the
 * page stops following the phone), and the boot script must run before paint
 * (or every load flashes the wrong theme).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readTheme, saveTheme, applyTheme, resolvedTheme,
  THEME_ORDER, THEME_BOOT_SCRIPT,
} from '@/lib-client/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});

describe('the stored choice', () => {
  it('defaults to following the phone', () => {
    expect(readTheme()).toBe('system');
  });

  it('round-trips a real choice', () => {
    saveTheme('light');
    expect(readTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores a junk value rather than trusting storage', () => {
    localStorage.setItem('tec_theme', 'neon');
    expect(readTheme()).toBe('system');
  });

  it('survives storage being blocked entirely', () => {
    // Private mode, or a browser set to refuse site data. A theme is a
    // preference, not a feature — it must degrade, never throw.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => readTheme()).not.toThrow();
    expect(readTheme()).toBe('system');
    spy.mockRestore();

    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveTheme('dark')).not.toThrow();
    // The attribute is still applied — the choice just is not remembered.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    set.mockRestore();
  });
});

describe('applying it', () => {
  it('REMOVES the attribute for "system" instead of resolving it', () => {
    // This is the whole point of having three states. Writing 'dark' here would
    // freeze the page at whatever the phone happened to be on first load; with
    // no attribute, the token layer's prefers-color-scheme query keeps tracking.
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light dark');
  });

  it('tells the browser which UA colours to use', () => {
    // Without color-scheme, native form controls and the scrollbar stay in the
    // default palette and look pasted onto the page.
    applyTheme('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('the cycle', () => {
  it('always returns to "system" — it is never a state you lose', () => {
    expect(THEME_ORDER).toContain('system');
    expect(THEME_ORDER[0]).toBe('system');
    let c = THEME_ORDER[0]!;
    for (let i = 0; i < THEME_ORDER.length; i++) {
      c = THEME_ORDER[(THEME_ORDER.indexOf(c) + 1) % THEME_ORDER.length]!;
    }
    expect(c).toBe('system');
  });
});

describe('resolvedTheme', () => {
  it('passes an explicit choice straight through', () => {
    expect(resolvedTheme('light')).toBe('light');
    expect(resolvedTheme('dark')).toBe('dark');
  });

  it('asks the phone for "system"', () => {
    const mm = vi.spyOn(window, 'matchMedia').mockReturnValue(
      { matches: true } as MediaQueryList);
    expect(resolvedTheme('system')).toBe('light');
    mm.mockReturnValue({ matches: false } as MediaQueryList);
    expect(resolvedTheme('system')).toBe('dark');
    mm.mockRestore();
  });
});

describe('the pre-paint boot script', () => {
  it('is inlined in <head> — anything deferred paints too late', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(layout).toContain('THEME_BOOT_SCRIPT');
    expect(layout).toMatch(/<head>[\s\S]*dangerouslySetInnerHTML[\s\S]*<\/head>/);
    // A hydration mismatch on <html> is expected and intended here: the script
    // changes the element before React ever sees it.
    expect(layout).toContain('suppressHydrationWarning');
  });

  it('reads the same key the module writes, and cannot throw', () => {
    expect(THEME_BOOT_SCRIPT).toContain("'tec_theme'");
    expect(THEME_BOOT_SCRIPT).toContain('try');
    expect(THEME_BOOT_SCRIPT).toContain('catch');
  });

  it('sets the attribute only for an explicit choice', () => {
    // "system" must fall through to the media query, exactly like applyTheme.
    for (const v of ['light', 'dark']) {
      localStorage.setItem('tec_theme', v);
      document.documentElement.removeAttribute('data-theme');
      new Function(THEME_BOOT_SCRIPT)();
      expect(document.documentElement.getAttribute('data-theme')).toBe(v);
    }
    localStorage.setItem('tec_theme', 'system');
    document.documentElement.removeAttribute('data-theme');
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('the token layer backs both themes', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/tec-design-tokens.css'), 'utf8');

  it('defines a light palette that an attribute can actually reach', () => {
    expect(css).toContain("[data-theme='light']");
    expect(css).toContain("[data-theme='dark']");
  });

  it('follows the phone only when no explicit choice is set', () => {
    // Scoped to :root:not([data-theme]) — otherwise a reader who picked dark
    // would be overridden by a light phone.
    expect(css).toMatch(/@media \(prefers-color-scheme: light\)[\s\S]*:root:not\(\[data-theme\]\)/);
  });

  it('darkens gold for light mode — the brand amber on white is unreadable', () => {
    const light = css.slice(css.indexOf("[data-theme='light']"));
    expect(light).toMatch(/--tec-gold:\s*#8f5f00/);
  });
});
