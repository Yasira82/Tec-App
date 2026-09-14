// IIC 4.5 §7 — what the human was looking at.
//
// The proof object carries `shown`, and the spec is blunt about why it is the field
// that matters:
//
//   "A proof that records what was approved but not what the human was looking at when
//    they approved it cannot settle the only dispute that ever arises."
//
// ── Why this is a module and not two lines in the modal ─────────────────────────
//
// The obvious implementation is to compose the sentence where the payment is created
// and render the amount and memo separately in the modal. That produces two expressions
// which agree today — and a proof is only worth anything for the day they stop agreeing.
// A `shown` assembled anywhere other than from the values actually rendered is the
// platform's *belief* about what it displayed, which is the very claim under dispute.
//
// So there is ONE composition. `shownParts` produces the three fields; the modal renders
// those fields and nothing else; `shownText` joins the same object for the metadata.
// Changing what the buyer reads without changing what the proof records now requires
// editing this file, which is the point.
//
// ── The honest limit of this record ─────────────────────────────────────────────
//
// This is the CLIENT's account of its own screen. The HMAC on the proof protects it
// from being altered afterwards — the forgery in the threat model (§9) — not from a
// client that lied at render time. That gap is closable and should be closed where the
// proof is recorded, not here: payment-service knows the amount Pi actually settled, so
// a `shown` whose amount disagrees with the completed payment is detectable server-side.
// Doing it here would be the client checking its own homework.

/**
 * The app name the modal titles the payment with.
 *
 * Lives here, not in the modal, for the reason this whole file exists: the label is one
 * of the three things the buyer reads, so the proof must record the SAME string the
 * screen showed — not a second switch statement that agrees with it today.
 */
export function sourceLabel(source: string): string {
  switch (source) {
    case 'commerce':   return 'TEC Commerce';
    case 'ecommerce':  return 'TEC Ecommerce';
    case 'assets':     return 'TEC Assets';
    case 'analytics':  return 'TEC Analytics';
    case 'life':       return 'TEC Life';
    case 'connection': return 'TEC Connection';
    case 'zone':       return 'TEC Zone';
    case 'nexus':      return 'TEC Nexus';
    default:           return 'TEC Ecosystem';
  }
}

/**
 * True on the paired Testnet host — the same test that decides whether the modal paints
 * the TESTNET chip, so the chip and the record cannot disagree.
 */
export const isTestnetPaymentHost = (): boolean =>
  typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);

export interface ShownParts {
  /** The app this payment is for, as the modal titles it — e.g. "TEC Nexus". */
  label:  string;
  /** The headline figure, formatted exactly as rendered — e.g. "250 π". */
  amount: string;
  /** The payment's own description. */
  memo:   string;
  /**
   * Present ONLY on the Testnet host, where the modal shows a TESTNET chip.
   *
   * It belongs in the record because it is material: a proof that reads identically
   * for Test-Pi and for real Pi cannot distinguish the two payments a person is most
   * likely to confuse.
   */
  network?: 'TESTNET';
}

export function shownParts(p: {
  label:   string;
  amount:  number;
  memo:    string;
  testnet: boolean;
}): ShownParts {
  return {
    label:  p.label,
    amount: `${p.amount} π`,
    memo:   p.memo,
    ...(p.testnet ? { network: 'TESTNET' as const } : {}),
  };
}

/**
 * The same object as one line, for `proof.human_approvals[].shown`.
 *
 * Deliberately readable rather than structured: this string is read by a person
 * settling a dispute, months later, who is comparing it against their memory of a
 * screen. A JSON blob would be a faithful record nobody can use as evidence.
 */
export function shownText(s: ShownParts): string {
  return [
    s.network ? `[${s.network}] ` : '',
    s.label,
    ' — ',
    s.amount,
    s.memo ? ` — ${s.memo}` : '',
  ].join('');
}
