// EVL domain accent for ecosystem app tiles (C-83). Keeps each app's emoji
// (brand personality) but gives its tile a consistent domain-colored tint —
// premium + on-brand without needing 24 custom icons.

const EVL = {
  gold:   '#FBBF24',   // WEALTH
  green:  '#22C55E',   // GROWTH
  cyan:   '#06B6D4',   // INTELLIGENCE
  purple: '#8B5CF6',   // IDENTITY
  blue:   '#3B82F6',   // GOVERNANCE
  red:    '#EF4444',   // RISK
} as const;

// Known apps → semantic EVL domain. Unknown slugs fall back to a stable hash.
const ACCENT: Record<string, string> = {
  // WEALTH
  assets: EVL.gold, wallet: EVL.gold, fundx: EVL.gold, legend: EVL.gold,
  // GOVERNANCE / finance-trust
  nbf: EVL.blue, insure: EVL.blue, system: EVL.blue,
  // GROWTH / commerce
  commerce: EVL.green, ecommerce: EVL.green, estate: EVL.green, brookfield: EVL.green, zone: EVL.green, life: EVL.green,
  // IDENTITY / connection / membership
  nexus: EVL.purple, connection: EVL.purple, vip: EVL.purple, elite: EVL.purple, tec: EVL.purple,
  // INTELLIGENCE / data / tooling
  analytics: EVL.cyan, explorer: EVL.cyan, dx: EVL.cyan, nx: EVL.cyan,
  // RISK / power
  alert: EVL.red, titan: EVL.red, epic: EVL.red,
};

const PALETTE = Object.values(EVL);

export function appAccent(slug: string): string {
  const known = ACCENT[slug?.toLowerCase?.() ?? ''];
  if (known) return known;
  let h = 0;
  for (const ch of slug ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** EVL accent as rgba with the given alpha (e.g. for tile bg/border). */
export function appAccentRgba(slug: string, alpha: number): string {
  const hex = appAccent(slug).slice(1);
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
