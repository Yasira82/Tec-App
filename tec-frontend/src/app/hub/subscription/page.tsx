'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken }                   from '@/lib-client/pi/pi-auth';
import { HubSubShell }                      from '@/components/hub';
import { DashboardCard }                    from '@/components/dashboard';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

interface Plan {
  id:       string;
  name:     string;
  price:    number;
  currency: string;
  duration: number;
  features: string[];
}

interface Subscription {
  plan:               string;
  status:             string;
  current_period_end: string | null;
  isExpired:          boolean;
  planDetails:        Plan;
}

const PLAN_CONFIG: Record<string, {
  color: string; bg: string; border: string; icon: string; popular?: boolean;
}> = {
  FREE:       { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', icon: '◯' },
  PRO:        { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  icon: '◈', popular: true },
  ENTERPRISE: { color: '#7eb8f7', bg: 'rgba(126,184,247,0.08)', border: 'rgba(126,184,247,0.25)', icon: '◉' },
};

function CurrentPlanCard({ sub, onCancel, cancelling }: {
  sub: Subscription; onCancel: () => void; cancelling: boolean;
}) {
  const cfg      = PLAN_CONFIG[sub.plan] ?? PLAN_CONFIG.FREE;
  const isActive = sub.status === 'ACTIVE';
  return (
    <div style={{
      padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-xl)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderRadius: '50%', background: `${cfg.color}08`, transform: 'translate(30%,-30%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Current Plan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, color: cfg.color }}>{cfg.icon}</span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: cfg.color }}>{sub.planDetails?.name}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
            {sub.planDetails?.price === 0 ? 'Free' : `${sub.planDetails?.price} π`}
          </div>
          {(sub.planDetails?.duration ?? 0) > 0 && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>/month</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sub.current_period_end ? 'var(--sp-3)' : 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#22C55E' : '#ef4444', display: 'inline-block' }} />
        <span style={{ fontSize: 'var(--text-sm)', color: isActive ? '#22C55E' : '#ef4444', fontWeight: 600 }}>
          {isActive ? 'Active' : sub.status}
        </span>
      </div>
      {sub.current_period_end && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)' }}>
          Renews {new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      )}
      {sub.plan !== 'FREE' && isActive && (
        <button onClick={onCancel} disabled={cancelling}
          style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--text-xs)', cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
          {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
        </button>
      )}
    </div>
  );
}

function PlanCard({ plan, isCurrent, isUpgrade, paying, onSubscribe }: {
  plan: Plan; isCurrent: boolean; isUpgrade: boolean;
  paying: string | null; onSubscribe: (id: string) => void;
}) {
  const cfg       = PLAN_CONFIG[plan.id] ?? PLAN_CONFIG.FREE;
  const isLoading = paying === plan.id;
  return (
    <div style={{
      padding: 'var(--sp-5)', position: 'relative',
      background: isCurrent ? cfg.bg : 'var(--tec-surface-1)',
      border: `1px solid ${isCurrent ? cfg.border : 'var(--tec-border)'}`,
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      {cfg.popular && !isCurrent && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--tec-gold)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', padding: '2px 10px', borderRadius: 'var(--radius-full)' }}>
          POPULAR
        </div>
      )}
      {isCurrent && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 10px', borderRadius: 'var(--radius-full)' }}>
          CURRENT
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18, color: cfg.color }}>{cfg.icon}</span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: cfg.color }}>{plan.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-text-1)' }}>
              {plan.price === 0 ? 'Free' : `${plan.price} π`}
            </span>
            {plan.price > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>/month</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--sp-4)' }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: cfg.color, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>{f}</span>
          </div>
        ))}
      </div>
      {!isCurrent && plan.id !== 'FREE' && (
        <button onClick={() => onSubscribe(plan.id)} disabled={!!paying}
          style={{
            width: '100%', padding: '11px', borderRadius: 'var(--radius-md)',
            background: isLoading ? cfg.bg : `linear-gradient(135deg,${cfg.color}25,${cfg.color}10)`,
            border: `1px solid ${cfg.border}`, color: cfg.color,
            fontSize: 'var(--text-sm)', fontWeight: 700,
            cursor: paying ? 'not-allowed' : 'pointer', opacity: paying && !isLoading ? 0.4 : 1,
          }}>
          {isLoading ? '⏳ Processing…' : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
        </button>
      )}
      {isCurrent && (
        <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: cfg.bg, border: `1px solid ${cfg.border}`, textAlign: 'center', fontSize: 'var(--text-sm)', color: cfg.color, fontWeight: 600 }}>
          ✓ Your current plan
        </div>
      )}
    </div>
  );
}

const STATIC_PLANS: Plan[] = [
  { id: 'FREE',       name: 'Free',       price: 0,  currency: 'PI', duration: 0,  features: ['Up to 5 assets', 'Basic wallet', 'Community access'] },
  { id: 'PRO',        name: 'Pro',        price: 10, currency: 'PI', duration: 30, features: ['Unlimited assets', 'Advanced wallet', 'Priority support', 'Analytics dashboard', 'Commerce store'] },
  { id: 'ENTERPRISE', name: 'Enterprise', price: 50, currency: 'PI', duration: 30, features: ['Everything in Pro', 'Custom domain', 'API access', 'Dedicated support', 'White-label options'] },
];

export default function HubSubscriptionPage() {
  const [plans,      setPlans]      = useState<Plan[]>([]);
  const [sub,        setSub]        = useState<Subscription | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getAccessToken();
    setPlans(STATIC_PLANS);
    try {
      const subRes = await fetch('/api/subscriptions?endpoint=status', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        const s = subData?.data?.subscription ?? subData?.data ?? subData;
        setSub(s?.plan ? s : null);
      }
    } catch { /* plans show regardless */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (planId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setPaying(planId); setError(null); setSuccess(null);
    try {
      const res  = await fetch('/api/subscriptions?endpoint=subscribe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to subscribe');
      setSub(data.data?.subscription);
      setSuccess(`Successfully subscribed to ${planId}!`);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setPaying(null); }
  };

  const handleCancel = async () => {
    const token = getAccessToken();
    if (!token || !confirm('Cancel your subscription?')) return;
    setCancelling(true); setError(null); setSuccess(null);
    try {
      const res  = await fetch('/api/subscriptions?endpoint=cancel', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to cancel');
      setSub(data.data?.subscription ?? { ...sub!, status: 'CANCELLED' });
      setSuccess('Subscription cancelled.');
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCancelling(false); }
  };

  const currentPlan = sub?.plan ?? 'FREE';
  const badge = currentPlan === 'ENTERPRISE'
    ? { text: 'ENTERPRISE', color: 'blue'  as const }
    : currentPlan === 'PRO'
    ? { text: 'PRO',        color: 'gold'  as const }
    : { text: 'FREE',       color: 'blue'  as const };

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

      {sub && <CurrentPlanCard sub={sub} onCancel={handleCancel} cancelling={cancelling} />}

      <DashboardCard title="Available Plans" subtitle={`${plans.length} plans`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              isUpgrade={plan.price > (sub?.planDetails?.price ?? 0)}
              paying={paying}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>
      </DashboardCard>
    </HubSubShell>
  );
}
