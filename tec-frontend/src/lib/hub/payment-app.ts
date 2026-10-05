/**
 * Recent payments on the Hub wallet card — which app each one was for, and
 * where it stands.
 *
 * The app comes from payment-service's `source` (the slug the payment was
 * created with: `app_source` from the Hub's Mode 1 modal, `source` from an app's
 * own Mode 2 call). It is shown by the registry's NAME, never as the raw slug:
 * a slug the registry does not know is not a name we can stand behind, so it
 * reads as a plain "Pi payment" instead.
 */
import { DOMAIN_REGISTRY } from '@/domains/_registry';
import { t as tr, type Locale } from '@/domains/_types';

/** The Hub's own payments say `hub`; the registry knows the Hub as `tec`. */
const HUB_ALIASES = new Set(['hub', 'tec']);

export function paymentAppName(source: string | null | undefined, locale: Locale): string | null {
  if (!source) return null;
  const slug = source.trim().toLowerCase();
  const domain = DOMAIN_REGISTRY[HUB_ALIASES.has(slug) ? 'tec' : slug];
  return domain ? tr(domain.name, locale) : null;
}

export type PaymentKind = 'completed' | 'pending' | 'failed' | 'cancelled';

/**
 * payment-service's lifecycle (created → approved → completed, or failed /
 * cancelled) folded into what a person needs to know. Anything unrecognised is
 * `pending` — never `completed`: a payment we cannot read is not shown as done.
 */
export function paymentKind(status: string): PaymentKind {
  switch (status.toLowerCase()) {
    case 'completed': return 'completed';
    case 'failed':    return 'failed';
    case 'cancelled':
    case 'canceled':  return 'cancelled';
    default:          return 'pending';
  }
}
