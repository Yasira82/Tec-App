/**
 * The space Android's own buttons take at the bottom of the screen, when the
 * browser draws the page underneath them and does not say so.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The Hub's bottom bar already pads itself with `env(safe-area-inset-bottom)`.
 * On 10 Nov 2026 the owner's phone (Android, three-button navigation, Pi
 * Browser) showed the bar sitting UNDER Back / Home / Recents: Pi Browser lays
 * the page out edge to edge and reports an inset of 0, so the padding was 0 and
 * every button of the bar was behind the system's. Nothing on the page could be
 * tapped there.
 *
 * The page cannot measure the system's button bar. What it can know is whether
 * the browser gave it an inset at all. So on Android, when the inset reads 0,
 * the bar reserves the height of the three-button bar (48px, Android's own
 * size). Where the browser does report an inset, that value wins and nothing
 * changes; on every other platform nothing changes either.
 *
 * Cost of being wrong in the other direction: on an Android browser that keeps
 * the page above its buttons, the bar is 48px taller than it needs to be. A
 * bar that is a little tall can still be used; one that sits under the
 * system's buttons cannot.
 *
 * Read with: `max(10px, env(safe-area-inset-bottom), var(--tec-safe-bottom-fallback, 0px))`.
 */
export const ANDROID_NAV_FALLBACK_PX = 48;

/** Pure decision, so it can be tested without a browser. */
export const safeBottomFallback = (userAgent: string, reportedInsetPx: number): number =>
  /Android/i.test(userAgent) && !(reportedInsetPx > 0) ? ANDROID_NAV_FALLBACK_PX : 0;

/**
 * Inline, synchronous, before first paint — the same reason as the theme
 * script: a bar that jumps up after the page has painted is a tap that lands
 * on the wrong button. Self-contained (no imports): it runs as a string.
 */
export const SAFE_BOTTOM_BOOT_SCRIPT = `(function(){try{
var ua=navigator.userAgent||'';
if(!/Android/i.test(ua))return;
var p=document.createElement('div');
p.style.cssText='position:fixed;left:0;bottom:0;height:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)';
document.documentElement.appendChild(p);
var inset=parseFloat(getComputedStyle(p).paddingBottom)||0;
p.parentNode.removeChild(p);
if(inset>0)return;
document.documentElement.style.setProperty('--tec-safe-bottom-fallback','${ANDROID_NAV_FALLBACK_PX}px');
}catch(e){}})();`;
