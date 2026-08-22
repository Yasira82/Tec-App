'use client';

import { useTranslation, fill, bcp47, type Translations } from '@/lib/i18n';

import { useState, useEffect, useCallback } from 'react';
import { createU2APayment }                 from '@/lib-client/pi/pi-payment';
import { HubSubShell }                      from '@/components/hub';
import { DashboardCard }                    from '@/components/dashboard';
import { sessionToken }                     from '@/lib-client/pi/session-source';
import {
  PLAN_META, PLAN_ORDER, FEATURE_ROWS, entitlementsFor, normalizePlan,
  type PlanId, type FeatureRow,
} from '@/lib/subscription/entitlements';

/**
 * Plan NAMES and feature LABELS come from the dictionary; the entitlement DATA
 * (limits, flags, `enforced`) stays in `entitlements.ts`, which the BFF enforces
 * against. Splitting it this way means a translation can never move a limit.
 */
const planName = (t: Translations, plan: PlanId) => t.hub.plans[plan].name;

/**
 * A localized feature cell. The ✓/— decision reads the ENTITLEMENT, never the
 * rendered string — the helper this replaces decided it by testing the English
 * words ('community', 'up to 0'), so translating this table would have silently
 * flipped ticks to dashes on the page people pay from.
 */
function featureCell(row: FeatureRow, plan: PlanId, t: Translations) {
  const pf    = t.hub.planFeatures;
  const label = (pf as unknown as Record<string, string>)[row.key] ?? row.label;
  const ent   = entitlementsFor(plan);

  if (row.key === 'assets') {
    const limit = ent.assetLimit;
    return { label, detail: limit === Infinity ? pf.unlimited : fill(pf.upTo, { n: limit }), on: limit > 0 };
  }
  if (row.key === 'support') {
    return { label, detail: pf[ent.supportTier], on: ent.supportTier !== 'community' };
  }
  const raw = row.value(plan);
  return { label, detail: '', on: raw === true };
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

interface Subscription {
  plan:               string;
  status:             string;
  current_period_end: string | null;
  daysRemaining?:     number | null;   // whole days left in the period (commerce)
  isExpired?:         boolean;          // period already elapsed (commerce)
}

// ── Renewal reminder ───────────────────────────────────────────
// Pi Pro is a ONE-TIME U2A payment — there is no auto-renewal, so the honest word
// is "Expires", not "Renews". Commerce sends daysRemaining + isExpired; we surface a
// calm line normally, an amber nudge in the last week, and a red prompt once lapsed.
function RenewalNotice({ endISO, daysRemaining, isExpired }: {
  endISO: string; daysRemaining: number | null | undefined; isExpired: boolean | undefined;
}) {
  const { t, locale } = useTranslation();
  const s       = t.hub.subscription;
  const dateStr = new Date(endISO).toLocaleDateString(bcp47(locale), { month: 'long', day: 'numeric', year: 'numeric' });
  const days    = typeof daysRemaining === 'number' ? daysRemaining : null;
  const expired = isExpired === true || days === 0;
  const soon    = !expired && days !== null && days <= 7;

  const tone = expired ? '#ef4444' : soon ? '#f59e0b' : 'var(--tec-text-3)';
  // Singular gets its own key rather than a `day${n===1?'':'s'}` splice — English
  // pluralization rules are not Arabic's, and the splice cannot express either.
  const line = expired
    ? fill(s.expiredOn, { date: dateStr })
    : days === 1
      ? fill(s.expiresInDay, { date: dateStr })
      : days !== null
        ? fill(s.expiresInDays, { n: days, date: dateStr })
        : fill(s.expiresOn, { date: dateStr });

  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: tone, fontWeight: (expired || soon) ? 700 : 400 }}>
        {expired ? '⚠️ ' : soon ? '⏳ ' : ''}{line}
      </div>
      {(soon || expired) && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 4, lineHeight: 1.5 }}>
          {s.noAutoRenew}
        </div>
      )}
    </div>
  );
}

// ── Honest "Live / Soon" tag ───────────────────────────────────
function EnforcedTag({ live }: { live: boolean }) {
  const { t } = useTranslation();
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
      padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap',
      color:      live ? '#22C55E' : 'var(--tec-text-3)',
      background: live ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${live ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`,
    }}>
      {live ? t.hub.subscription.enforcedLive : t.hub.subscription.enforcedSoon}
    </span>
  );
}

// ── Free asset usage bar (a REAL, enforced limit) ──────────────
function UsageBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useTranslation();
  const pct     = Math.min(100, Math.round((used / limit) * 100));
  const nearCap = used >= limit;
  const color   = nearCap ? '#ef4444' : used / limit >= 0.8 ? '#f59e0b' : '#22C55E';
  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.subscription.assetsUsed}</span>
        <span style={{ fontSize: 'var(--text-xs)', color, fontWeight: 700 }}>{used} / {limit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--tec-surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s ease' }} />
      </div>
      {nearCap && (
        <div style={{ fontSize: 'var(--text-xs)', color: '#ef4444', marginTop: 6 }}>
          {t.hub.subscription.atLimit}
        </div>
      )}
    </div>
  );
}

// ── Plan card ──────────────────────────────────────────────────
function PlanCard({ plan, current, isUpgrade, paying, onSubscribe }: {
  plan: PlanId; current: boolean; isUpgrade: boolean;
  paying: string | null; onSubscribe: (id: PlanId) => void;
}) {
  const { t } = useTranslation();
  const meta      = PLAN_META[plan];
  const isLoading = paying === plan;
  const popular   = plan === 'PRO';

  return (
    <div style={{
      padding: 'var(--sp-5)', position: 'relative',
      background: current ? `${meta.color}0d` : 'var(--tec-surface-1)',
      border: `1px solid ${current ? `${meta.color}55` : 'var(--tec-border)'}`,
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {(popular && !current) && (
        <div style={{ position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: 'var(--tec-gold)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', padding: '2px 10px', borderRadius: 999 }}>
          {t.hub.subscription.popular}
        </div>
      )}
      {current && (
        <div style={{ position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}55`, padding: '2px 10px', borderRadius: 999 }}>
          {t.hub.subscription.current}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: meta.color }}>{planName(t, plan)}</span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-3)' }}>{t.hub.plans[plan].tagline}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'var(--sp-4)' }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
          {meta.price === 0 ? t.hub.subscription.free : `${meta.price} π`}
        </span>
        {meta.price > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.subscription.perMonth}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 'var(--sp-4)' }}>
        {FEATURE_ROWS.map(row => {
          const { label, detail, on } = featureCell(row, plan, t);
          return (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, width: 14, flexShrink: 0, color: on ? meta.color : 'var(--tec-text-3)' }}>{on ? '✓' : '—'}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: on ? 'var(--tec-text-2)' : 'var(--tec-text-3)' }}>
                {label}{detail ? ` · ${detail}` : ''}
              </span>
              <EnforcedTag live={row.enforced} />
            </div>
          );
        })}
      </div>

      {current ? (
        <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: `${meta.color}12`, border: `1px solid ${meta.color}44`, textAlign: 'center', fontSize: 'var(--text-sm)', color: meta.color, fontWeight: 700 }}>
          {t.hub.subscription.yourPlan}
        </div>
      ) : plan !== 'FREE' ? (
        <button onClick={() => onSubscribe(plan)} disabled={!!paying}
          style={{
            width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
            background: isLoading ? `${meta.color}18` : `linear-gradient(135deg,${meta.color}30,${meta.color}12)`,
            border: `1px solid ${meta.color}55`, color: meta.color,
            fontSize: 'var(--text-sm)', fontWeight: 700,
            cursor: paying ? 'not-allowed' : 'pointer', opacity: paying && !isLoading ? 0.4 : 1,
          }}>
          {isLoading
            ? `⏳ ${t.hub.subscription.processing}`
            : fill(isUpgrade ? t.hub.subscription.upgradeTo : t.hub.subscription.switchTo, { plan: planName(t, plan) })}
        </button>
      ) : null}
    </div>
  );
}

export default function HubSubscriptionPage() {
  const { t } = useTranslation();
  const [sub,        setSub]        = useState<Subscription | null>(null);
  const [assetsUsed, setAssetsUsed] = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = sessionToken();
    const auth  = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const [subRes, assetsRes] = await Promise.all([
        fetch('/api/subscriptions?endpoint=status', { credentials: 'include', headers: auth }),
        fetch('/api/bff/assets/list',               { credentials: 'include', headers: auth }),
      ]);
      if (subRes.ok) {
        const j = await subRes.json().catch(() => ({}));
        const s = j?.data?.subscription ?? j?.data ?? j;
        setSub(s?.plan ? s : { plan: 'FREE', status: 'ACTIVE', current_period_end: null });
      } else {
        setSub({ plan: 'FREE', status: 'ACTIVE', current_period_end: null });
      }
      if (assetsRes.ok) {
        const j   = await assetsRes.json().catch(() => ({}));
        const arr = j?.data ?? j?.assets ?? j;
        setAssetsUsed(Array.isArray(arr) ? arr.length : (typeof j?.total === 'number' ? j.total : null));
      }
    } catch { setSub({ plan: 'FREE', status: 'ACTIVE', current_period_end: null }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (planId: PlanId) => {
    const meta = PLAN_META[planId];
    setPaying(planId); setError(null); setSuccess(null);
    try {
      // 1) Take a REAL Pi payment first (approve+complete are verified by
      //    payment-service). No payment → no upgrade.
      const pay = await createU2APayment(
        meta.price,
        `TEC ${meta.name} subscription — 1 month`,
        { type: 'subscription', plan: planId },
      );
      if (!pay.success || pay.status !== 'completed') {
        if (pay.status === 'cancelled') { setError(t.hub.subscription.payCancelled); return; }
        throw new Error(pay.message ?? t.hub.subscription.payIncomplete);
      }

      // 2) Activate the subscription, linked to the paid Pi payment.
      //    Cookie-auth only (tec_access_token is HttpOnly).
      const token = sessionToken();
      const res   = await fetch('/api/subscriptions?endpoint=subscribe', {
        method: 'POST', credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: planId, piPaymentId: pay.paymentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? t.hub.subscription.payActivationFailed);
      setSuccess(fill(t.hub.subscription.paidNowOn, { plan: planName(t, planId) }));
      await fetchData();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setPaying(null); }
  };

  const handleCancel = async () => {
    if (!confirm(t.hub.subscription.cancelConfirm)) return;
    const token = sessionToken();
    setCancelling(true); setError(null); setSuccess(null);
    try {
      const res  = await fetch('/api/subscriptions?endpoint=cancel', {
        method: 'PATCH', credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? t.hub.subscription.cancelFailed);
      setSuccess(t.hub.subscription.cancelled);
      await fetchData();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCancelling(false); }
  };

  const plan: PlanId = normalizePlan(sub?.plan);
  const meta         = PLAN_META[plan];
  const ent          = entitlementsFor(plan);
  const isActivePaid = plan !== 'FREE' && String(sub?.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
  // The badge showed the raw plan ENUM ('FREE'/'PRO') — an identifier, not copy.
  // It reads as the plan's name, so it gets the plan's translated name.
  const badge = {
    text:  planName(t, plan).toUpperCase(),
    color: (plan === 'PRO' ? 'gold' : 'blue') as 'gold' | 'blue',
  };

  return (
    <HubSubShell
      title={t.hub.subscription.title}
      subtitle={t.hub.subscription.subtitle}
      badge={badge}
      loading={loading}
      actions={
        <button onClick={fetchData}
          style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          ↻
        </button>
      }
    >
      {error && (
        <div style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#ef4444' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#22C55E' }}>
          ✓ {success}
        </div>
      )}

      {/* Current plan + real asset usage */}
      <div style={{
        padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)',
        background: `${meta.color}0d`, border: `1px solid ${meta.color}44`,
        borderRadius: 'var(--radius-xl)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{t.hub.subscription.currentPlan}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, color: meta.color }}>{meta.icon}</span>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: meta.color }}>{planName(t, plan)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
              {meta.price === 0 ? t.hub.subscription.free : `${meta.price} π`}
            </div>
            {meta.price > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>{t.hub.subscription.perMonth}</div>}
          </div>
        </div>

        {sub?.current_period_end && (
          <RenewalNotice
            endISO={sub.current_period_end}
            daysRemaining={sub.daysRemaining}
            isExpired={sub.isExpired}
          />
        )}

        {/* The one entitlement enforced today: asset limit */}
        {Number.isFinite(ent.assetLimit) && assetsUsed !== null && (
          <UsageBar used={assetsUsed} limit={ent.assetLimit} />
        )}
        {!Number.isFinite(ent.assetLimit) && (
          <div style={{ fontSize: 'var(--text-xs)', color: meta.color, marginTop: 'var(--sp-3)', fontWeight: 600 }}>
            {t.hub.subscription.unlimited}{assetsUsed !== null ? ` · ${t.hub.subscription.created.replace('{n}', String(assetsUsed))}` : ''}
          </div>
        )}

        {isActivePaid && (
          <button onClick={handleCancel} disabled={cancelling}
            style={{ marginTop: 'var(--sp-4)', padding: '7px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--text-xs)', cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
            {cancelling ? t.hub.subscription.cancelling : t.hub.subscription.cancel}
          </button>
        )}
      </div>

      <DashboardCard title={t.hub.subscription.plans} subtitle={t.hub.subscription.plansSub}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {PLAN_ORDER.map(p => (
            <PlanCard
              key={p}
              plan={p}
              current={p === plan}
              isUpgrade={PLAN_META[p].price > meta.price}
              paying={paying}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>

        {/* Honesty footer — no charging for features that aren't live */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 'var(--sp-5)', padding: 'var(--sp-3) var(--sp-4)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', lineHeight: 1.6 }}>
          <span style={{ flexShrink: 0 }}>ℹ️</span>
          <span>{t.hub.subscription.honesty}</span>
        </div>
      </DashboardCard>
    </HubSubShell>
  );
}
