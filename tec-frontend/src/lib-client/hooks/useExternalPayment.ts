'use client';

import { useEffect, useState } from 'react';
import { isAllowedAppUrl }     from '@/domains/allowed-origins';
import { piSession }           from '@/lib-client/pi/pi-session';
import { tecSession }          from '@/lib-client/pi/tec-session';
import { getStoredUser }       from '@/lib-client/pi/pi-auth';
import { sessionToken }        from '@/lib-client/pi/session-source';
import type { ExternalPayment } from '@/app/hub/components/PaymentModal';
import { shownParts, shownText, sourceLabel, isTestnetPaymentHost } from '@/lib-client/payment/shown';

/**
 * A Mode-1 payment as it arrives on the URL, before the record exists — the
 * modal's shape minus the id only tec-payment-service can issue. Derived, not
 * re-declared: PaymentModal owns this contract (P1).
 */
export type PendingPayment = Omit<ExternalPayment, 'internalId'>;

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

/**
 * The URL to return to, or the Hub when the caller named one this Hub may not
 * send a user to. Fails closed (P6): an unknown origin is not a reason to
 * navigate somewhere unexpected, it is a reason to stay home.
 */
const safeReturnUrl = (raw: string | null): string => {
  const home = `${window.location.origin}/hub`;
  if (!raw) return home;
  const decoded = decodeURIComponent(raw);
  return isAllowedAppUrl(decoded) ? decoded : home;
};

/** Send the caller back to the originating app with an explicit failure reason. */
const bounceBack = (returnUrl: string, reason: string) => {
  const ret = new URL(returnUrl);
  ret.searchParams.set('payment_status', 'error');
  ret.searchParams.set('reason', reason);
  window.location.href = ret.toString();
};

interface Args {
  /** Auth is still resolving — see C-123 §7 below for why this blocks. */
  isLoading: boolean;
  piReady:   boolean;
  user:      { id?: string; piId?: string } | null;
  onError:   () => void;
}

/**
 * Reads a `?pay=1` Mode-1 handoff off the URL and turns it into a real payment
 * record, so the Hub can open its modal (ADR-007: apps in a Pi foreign session
 * bounce their payment here rather than calling `Pi.authenticate` themselves).
 *
 * Lives outside the page because it is a two-step state machine with its own
 * lifecycle — reading the URL once on mount, then waiting for BOTH the Pi SDK
 * and auth before it may create anything.
 */
export function useExternalPayment({ isLoading, piReady, user, onError }: Args) {
  const [pending,  setPending]  = useState<PendingPayment | null>(null);
  const [external, setExternal] = useState<ExternalPayment | null>(null);

  /* ── Step 1: read the URL params immediately ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('pay') !== '1') return;

    const amount = parseFloat(p.get('amount') ?? '0');
    if (!(amount > 0)) return;

    setPending({
      amount,
      memo:         decodeURIComponent(p.get('memo') ?? 'TEC Payment'),
      // `product_id` is the documented name; `item` is what tec-template-base — and the
      // 17 apps cloned from it — send. Reading only `product_id` recorded those payments
      // with no product, so commerce could not tell a Pro purchase from anything else and
      // activated nothing. `||`, not `??`: an empty `product_id=` must not hide `item`.
      productId:    p.get('product_id') || p.get('item') || '',
      nexusRunId:   p.get('nexus_run')  ?? '',
      nexusStepIdx: p.get('nexus_step') ?? '',
      // Where to send the user after Cancel or success. Two rules:
      //
      // 1. It must be ALLOWLISTED. This URL is navigated to, and on success it
      //    carries `payment_id` and `txid` — so an unchecked `return_url` is an
      //    open redirect that also leaks the payment's identifiers to whatever
      //    origin the link named. The list is the SSO one (P1: one list).
      // 2. Falling back lands on the HUB, not Commerce. The old Commerce
      //    default dumped every template-app Mode-1 payment onto Commerce.
      //
      // An app that sends no return_url still lands on the Hub, which is what
      // made "Cancel" feel wrong: the user never left the app in their mind.
      // The fix is for the app to send one — not for the Hub to guess.
      returnUrl:    safeReturnUrl(p.get('return_url')),
      source:       p.get('source') ?? 'hub',
    });
    window.history.replaceState({}, '', '/hub');
  }, []);

  /* ── Step 1b: start the Pi handshake NOW, beside the rest ── */
  useEffect(() => {
    if (!(piReady && pending)) return;
    // Everything below this used to be a straight line: wait for auth to
    // settle → POST /payment/create → render the modal → and only THEN warm
    // the Pi session. Four steps, none overlapping, before the handshake even
    // began. That is the whole "I paid in the Hub, came back to the app, and
    // the payment takes forever" report — the app bounces here (Mode 1), and
    // on arrival nothing starts until everything before it has finished.
    //
    // The handshake needs none of it. It needs the SDK, which is ready. So it
    // runs in parallel with the auth resolution and the create round-trip, and
    // by the time the modal renders there is nothing left to wait for.
    //
    // Safe to start this early ONLY because of the gate: `withAuthGate`
    // serializes this against login's silent re-auth (Pi Browser breaks on
    // concurrent authenticate calls), and an adopted login makes it a no-op.
    piSession.ensurePaymentsReady().catch(() => { /* the tap retries */ });
  }, [piReady, pending]);

  /* ── Step 2: piReady + auth settled → create the record ── */
  useEffect(() => {
    if (!(piReady && pending && !external)) return;
    // C-123 §7: wait for auth resolution to settle — it makes the in-memory
    // session available in cookie-refusing contexts, where the old cookie-only
    // read left this flow stuck on "Preparing payment…" forever. (Serializing
    // the two Pi.authenticate calls is no longer this gate's job: withAuthGate
    // does it directly, which is what frees step 1b to run early.)
    if (isLoading) return;
    let cancelled = false;

    (async () => {
      const storedUser = user ?? tecSession.user ?? getStoredUser();
      const userId = (storedUser as { id?: string; piId?: string } | null)?.id
                  ?? (storedUser as { id?: string; piId?: string } | null)?.piId;
      if (!userId) return;

      try {
        const res = await fetch('/api/payment/create', {
          method:      'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${tecSession.token ?? sessionToken()}`,
            'x-csrf-token': getCsrfToken(),
          },
          body: JSON.stringify({
            // amount = number — matches tec-payment-service (ADR-009) and all apps.
            // String() made payment-service reject → internalId=null → modal flash.
            amount:         pending.amount,
            currency:       'PI',
            payment_method: 'pi',
            source:         'hub',
            metadata: {
              app_source: pending.source,
              product_id: pending.productId,
              // Nexus run link — only when this is a Nexus workflow-run payment. Lets the
              // Nexus consumer resume the run once payment.completed fires (C-109 §5).
              ...(pending.nexusRunId
                ? { nexusRunId: pending.nexusRunId, nexusStepIdx: Number(pending.nexusStepIdx) }
                : {}),
              // IIC 4.5 §7 — what the human is about to look at, recorded WITH the
              // payment rather than reconstructed from it afterwards.
              //
              // `shownParts` is the same composition the modal renders from, so this
              // string and the screen cannot drift apart: changing one means editing
              // lib-client/payment/shown, which changes both.
              //
              // It rides in the payment's own metadata for the same reason the Nexus
              // link does — that metadata is what reaches `payment.completed.v1`, so
              // the record arrives bound to the payment it describes instead of as a
              // separate claim about it. The proof (intent.proof.ts) is where it is
              // signed; here it is only captured.
              shown: shownText(shownParts({
                label:   sourceLabel(pending.source),
                amount:  pending.amount,
                memo:    pending.memo,
                testnet: isTestnetPaymentHost(),
              })),
            },
          }),
        });

        const data       = await res.json().catch(() => ({}));
        const internalId = data?.data?.payment?.id ?? data?.data?.id ?? data?.data?.payment_id ?? null;

        if (cancelled) return;

        if (!internalId) {
          bounceBack(pending.returnUrl, 'create_failed');
          return;
        }

        setExternal({ ...pending, internalId });
        setPending(null);
      } catch {
        if (cancelled) return;
        onError();
        bounceBack(pending.returnUrl, 'create_failed');
      }
    })();

    return () => { cancelled = true; };
  }, [piReady, pending, external, isLoading, user, onError]);

  return { pending, external, clearExternal: () => setExternal(null) };
}
