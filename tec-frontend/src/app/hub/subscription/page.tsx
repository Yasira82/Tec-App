'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken }                   from '@/lib-client/pi/pi-auth';
import { createU2APayment }                 from '@/lib-client/pi/pi-payment';
import { HubSubShell }                      from '@/components/hub';
import { DashboardCard }                    from '@/components/dashboard';
import {
  PLAN_META, PLAN_ORDER, FEATURE_ROWS, entitlementsFor, normalizePlan,
  type PlanId,
} from '@/lib/subscription/entitlements';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

interface Subscription {
  plan:               string;
  status:             string;
  current_period_end: string | null;
}

// ── Honest "Live / Soon" tag ───────────────────────────────────
function EnforcedTag({ live }: { live: boolean }) {
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
      padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap',
      color:      live ? '#22C55E' : 'var(--tec-text-3)',
      background: live ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${live ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`,
    }}>
      {live ? 'Live' : 'Soon'}
    </span>
  );
}

function cellText(v: string | boolean): { text: string; on: boolean } {
  if (typeof v === 'boolean') return { text: v ? '✓' : '—', on: v };
  return { text: v, on: v.toLowerCase() !== 'community' && !v.toLowerCase().startsWith('up to 0') };
}

// ── Free asset usage bar (a REAL, enforced limit) ──────────────
function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct     = Math.min(100, Math.round((used / limit) * 100));
  const nearCap = used >= limit;
  const color   = nearCap ? '#ef4444' : used / limit >= 0.8 ? '#f59e0b' : '#22C55E';
  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>Assets used</span>
        <span style={{ fontSize: 'var(--text-xs)', color, fontWeight: 700 }}>{used} / {limit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--tec-surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s ease' }} />
      </div>
      {nearCap && (
        <div style={{ fontSize: 'var(--text-xs)', color: '#ef4444', marginTop: 6 }}>
          You&apos;ve reached the Free limit — upgrade to Pro for unlimited assets.
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
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: 'var(--tec-gold)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', padding: '2px 10px', borderRadius: 999 }}>
          POPULAR
        </div>
      )}
      {current && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}55`, padding: '2px 10px', borderRadius: 999 }}>
          CURRENT
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: meta.color }}>{meta.name}</span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-3)' }}>{meta.tagline}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'var(--sp-4)' }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
          {meta.price === 0 ? 'Free' : `${meta.price} π`}
        </span>
        {meta.price > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>/month</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 'var(--sp-4)' }}>
        {FEATURE_ROWS.map(row => {
          const { text, on } = cellText(row.value(plan));
          return (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, width: 14, flexShrink: 0, color: on ? meta.color : 'var(--tec-text-3)' }}>{on ? '✓' : '—'}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: on ? 'var(--tec-text-2)' : 'var(--tec-text-3)' }}>
                {row.label}{typeof row.value(plan) === 'string' ? ` · ${text}` : ''}
              </span>
              <EnforcedTag live={row.enforced} />
            </div>
          );
        })}
      </div>

      {current ? (
        <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: `${meta.color}12`, border: `1px solid ${meta.color}44`, textAlign: 'center', fontSize: 'var(--text-sm)', color: meta.color, fontWeight: 700 }}>
          ✓ Your current plan
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
          {isLoading ? '⏳ Processing…' : isUpgrade ? `Upgrade to ${meta.name}` : `Switch to ${meta.name}`}
        </button>
      ) : null}
    </div>
  );
}

export default function HubSubscriptionPage() {
  const [sub,        setSub]        = useState<Subscription | null>(null);
  const [assetsUsed, setAssetsUsed] = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getAccessToken();
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
        if (pay.status === 'cancelled') { setError('Payment cancelled — your plan was not changed.'); return; }
        throw new Error(pay.message ?? 'Payment did not complete — your plan was not changed.');
      }

      // 2) Activate the subscription, linked to the paid Pi payment.
      //    Cookie-auth only (tec_access_token is HttpOnly).
      const token = getAccessToken();
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
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Payment succeeded but activation failed — please contact support.');
      setSuccess(`Payment complete — you're now on ${meta.name}.`);
      await fetchData();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setPaying(null); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You will move to the Free plan.')) return;
    const token = getAccessToken();
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
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to cancel');
      setSuccess('Subscription cancelled — you are on the Free plan.');
      await fetchData();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCancelling(false); }
  };

  const plan: PlanId = normalizePlan(sub?.plan);
  const meta         = PLAN_META[plan];
  const ent          = entitlementsFor(plan);
  const isActivePaid = plan !== 'FREE' && String(sub?.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
  const badge = plan === 'ENTERPRISE'
    ? { text: 'ENTERPRISE', color: 'blue' as const }
    : plan === 'PRO'
    ? { text: 'PRO', color: 'gold' as const }
    : { text: 'FREE', color: 'blue' as const };

  return (
    <HubSubShell
      title="Subscription"
      subtitle="Manage your TEC plan"
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
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Current Plan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, color: meta.color }}>{meta.icon}</span>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: meta.color }}>{meta.name}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
              {meta.price === 0 ? 'Free' : `${meta.price} π`}
            </div>
            {meta.price > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>/month</div>}
          </div>
        </div>

        {sub?.current_period_end && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 'var(--sp-3)' }}>
            Renews {new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        {/* The one entitlement enforced today: asset limit */}
        {Number.isFinite(ent.assetLimit) && assetsUsed !== null && (
          <UsageBar used={assetsUsed} limit={ent.assetLimit} />
        )}
        {!Number.isFinite(ent.assetLimit) && (
          <div style={{ fontSize: 'var(--text-xs)', color: meta.color, marginTop: 'var(--sp-3)', fontWeight: 600 }}>
            ✓ Unlimited assets{assetsUsed !== null ? ` · ${assetsUsed} created` : ''}
          </div>
        )}

        {isActivePaid && (
          <button onClick={handleCancel} disabled={cancelling}
            style={{ marginTop: 'var(--sp-4)', padding: '7px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--text-xs)', cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
            {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
          </button>
        )}
      </div>

      <DashboardCard title="Plans" subtitle="Upgrade any time">
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
          <span>
            <b style={{ color: '#22C55E' }}>Live</b> features are enforced today (the asset limit is active now).{' '}
            <b>Soon</b> features are in active development — they&apos;ll switch on for your plan automatically as they ship.
          </span>
        </div>
      </DashboardCard>
    </HubSubShell>
  );
}
