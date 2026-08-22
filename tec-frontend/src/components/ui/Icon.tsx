import type { CSSProperties } from 'react';

/**
 * TEC icon set — inline stroke SVG (lucide-style). Pi-Browser-safe:
 * no icon fonts, no external deps, no CSS modules. Uses currentColor by
 * default so callers control color via the `color` prop or parent `color`.
 *
 * Replaces ad-hoc emoji icons (🔔 🛒 💎 ⚙️ 🤖 …) with a consistent,
 * professional, scalable set. Add new glyphs to PATHS below.
 */
export type IconName =
  | 'hub' | 'wallet' | 'gem' | 'cart' | 'settings'
  | 'bell' | 'sparkles' | 'store' | 'receipt' | 'chart' | 'box' | 'plus'
  | 'shield' | 'shieldCheck' | 'check' | 'clock' | 'x' | 'info' | 'upload' | 'alert' | 'camera'
  // ── App glyphs (the 23-app launcher) ────────────────────────────────
  // Drawn on the same 24×24 grid, same 1.8 stroke, so a section reads as one
  // family. Emoji could not: the platform font renders half of them as glossy
  // 3D objects and half as flat grey line art, and it gave two pairs of apps
  // the identical picture (Nexus/Explorer both 🧭, Zone/Insure both 🛡️).
  | 'trending' | 'briefcase' | 'landmark' | 'target' | 'rocket' | 'code'
  | 'home' | 'towers' | 'search' | 'sprout' | 'link'
  | 'trophy' | 'award' | 'crown' | 'scale' | 'network';

/** Exported so `app-icons.test.ts` can hold the set to one 24x24 grid. */
export const PATHS: Record<IconName, string> = {
  hub:      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  wallet:   '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h.01"/>',
  gem:      '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  cart:     '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  bell:     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  store:    '<path d="m2 7 1.5-3.5A1 1 0 0 1 4.4 3h15.2a1 1 0 0 1 .9.5L22 7"/><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M2 7h20a0 0 0 0 1 0 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/>',
  receipt:  '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  chart:    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><rect x="7" y="11" width="3" height="6" rx="0.5"/><rect x="12" y="7" width="3" height="10" rx="0.5"/><rect x="17" y="13" width="3" height="4" rx="0.5"/>',
  box:      '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  plus:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
  shield:      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
  check:       '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  clock:       '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  x:           '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  info:        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  upload:      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  alert:       '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  camera:      '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>',

  // ── App glyphs ───────────────────────────────────────────────────────
  trending:  '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  landmark:  '<path d="M3 22h18"/><path d="M6 18V11"/><path d="M10 18V11"/><path d="M14 18V11"/><path d="M18 18V11"/><path d="m12 2 9 6H3Z"/>',
  // Three concentric rings — "the right opportunity". NX is the Opportunity
  // Exchange since ADR-010; the old puzzle piece still described the security
  // /integration app it stopped being.
  target:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3"/>',
  rocket:    '<path d="M12 2.5c2.7 2.7 4 6 4 9.4L12 15.7 8 11.9c0-3.4 1.3-6.7 4-9.4Z"/><circle cx="12" cy="9" r="1.7"/><path d="M8 12.2 5.6 14.6v3.6l2.6-2.4"/><path d="M16 12.2l2.4 2.4v3.6l-2.6-2.4"/>',
  code:      '<path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/>',
  home:      '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  // Two office towers — institutional property. Distinct from `home` (Estate)
  // and `landmark` (Titan), which sit beside it in the grid.
  towers:    '<path d="M2.5 21h19"/><path d="M4.5 21V8.5h6.5V21"/><path d="M11 21V3.5h8.5V21"/><path d="M6.7 11.5h2M6.7 15h2M13.4 7h3.5M13.4 11h3.5M13.4 15h3.5"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sprout:    '<path d="M12 21v-8"/><path d="M12 13C12 9 9 6 4 6c0 5 3 7 8 7Z"/><path d="M12 13c0-3.5 2.5-6 7-6 0 4.5-2.5 6-7 6Z"/>',
  link:      '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 19.5"/>',
  // The reputation chain reads left to right and must not blur together:
  // trophy (Legend — what you achieved) → award rosette (Elite — recognition)
  // → crown (VIP — privilege).
  trophy:    '<path d="M7 4h10v5.5a5 5 0 0 1-10 0Z"/><path d="M17 5.5h2.5v1.5a3 3 0 0 1-3 3"/><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3"/><path d="M12 14.5V18"/><path d="M8.5 20.5h7"/><path d="M9.5 18h5v2.5h-5Z"/>',
  award:     '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7.2 21.5 12 18.8l4.8 2.7-1.4-8.1"/>',
  crown:     '<path d="M3 17.5V8l4.6 3.6L12 4.5l4.4 7.1L21 8v9.5Z"/><path d="M3 20.5h18"/>',
  scale:     '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M4 7h16"/><path d="m4 7-3 6a3 3 0 0 0 6 0Z"/><path d="m20 7 3 6a3 3 0 0 1-6 0Z"/>',
  network:   '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4M12 11.5 6.8 16.2M12 11.5l5.2 4.7"/>',
};

interface IconProps {
  name:         IconName;
  size?:        number;
  color?:       string;
  strokeWidth?: number;
  style?:       CSSProperties;
}

export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      // `stroke` goes through inline STYLE, not the presentation attribute.
      // Callers now pass design tokens (`var(--tec-gold)`); a presentation
      // attribute that fails to resolve leaves stroke unset and the icon
      // invisible, so the value belongs where var() is guaranteed to work.
      // An explicit style from the caller still wins.
      style={{ stroke: color, ...style }}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
