/**
 * The ONE place TEC can be reached — the support menu, the legal pages and the
 * account-deletion request all read it, so they cannot disagree.
 *
 * Until 16 Nov 2026 the privacy and terms pages gave `privacy@tec.pi` and
 * `legal@tec.pi`. `.pi` names resolve only inside Pi Browser; no mail server
 * answers them, so a person writing to either got nothing back — on the pages
 * that promise a reply within five business days. The owner chose these two
 * (the same ones the support menu already published).
 */
export const CONTACT_EMAIL = 'yasserrr.fox17@gmail.com';

/**
 * International form for `tel:`; WhatsApp's wa.me takes the same digits without the +.
 * The support menu only — the legal pages carry the email and no number (owner, 16 Nov 2026).
 */
export const CONTACT_PHONE = '+201109742713';

export const mailto = (subject?: string) =>
  `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
