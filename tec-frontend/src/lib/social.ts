/**
 * Where TEC can be reached.
 *
 * ── One file, on purpose ────────────────────────────────────────────────────
 * These links go on the login screen and in Settings, in every app. Copying
 * them per app is how the fleet ends up with twelve apps pointing at a Telegram
 * channel that moved — the exact drift that has now cost this platform four
 * separate sweeps (the palette, the Dependabot policy, the band radius, the CI
 * cache). When this is proven on a device it moves to `@yasser172/tec-ui` so
 * there is one copy for all 24 apps, not 24.
 *
 * ── An empty string means "do not render" ───────────────────────────────────
 * NOT "render a dead link". A social icon that opens nothing is worse than an
 * absent one: the user concludes the product is abandoned, and they are making
 * a reasonable inference. Fill a handle in and it appears; leave it out and it
 * simply is not there.
 */

export interface SocialLink {
  key:   string;
  label: string;
  href:  string;
}

/** Every link is https and opens in a new tab — see `SocialLinks`. */
export const SOCIAL: SocialLink[] = [
  // TEC Connection — ours, and the only one that is not a third party. It leads
  // INTO the ecosystem rather than out of it, which is why it is first.
  { key: 'connection', label: 'TEC Connection', href: 'https://connection.tecosystem.app' },

  // A private-group invite link, not a public channel handle: it is revocable
  // from inside Telegram, which a @username is not.
  { key: 'telegram', label: 'Telegram', href: 'https://t.me/+7yEiJGgSZ2QzM2M0' },

  // ⚠️ A /share/ link, and it is NOT stable. Facebook mints these per share:
  // the same profile produced 19G28ma6yK and then 198YXN8kaF thirteen minutes
  // apart, which means the one below can stop resolving with no warning and no
  // error on our side — it would simply 404 for users, in 24 apps at once.
  //
  // The durable form is a username URL (facebook.com/<username>), set once in
  // Facebook under Settings → Personal details → Username. Replace this line
  // with it the moment it exists.
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/share/198YXN8kaF/' },

  { key: 'x', label: 'X', href: 'https://x.com/TEC1c5' },

  // Confirmed by the owner. A wa.me link publishes this number to every user of
  // 24 live apps and cannot be un-published once scraped — which is why it was
  // held for an explicit decision rather than shipped by default. That decision
  // was made; it is not re-litigated on every future edit.
  //
  // 01109742713 in local form. wa.me needs the international one with no + and
  // no leading zero, so the country code REPLACES the 0: 20 + 1109742713.
  { key: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/201109742713' },
];

/**
 * Only the ones actually configured, and only if they are real https URLs.
 *
 * The `startsWith` check is not paranoia about our own constants — it is the
 * `C_HUB_URL` lesson (July 2026): a placeholder that looked like a value became
 * a live redirect target and 404'd for every user. A non-URL here is treated as
 * absent rather than rendered as a link to nowhere.
 */
export const activeSocial = (): SocialLink[] =>
  SOCIAL.filter((s) => s.href.startsWith('https://'));
