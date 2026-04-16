'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

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

const PLAN_COLORS: Record<string, string> = {
  FREE:       '#6b6b7a',
  PRO:        '#d4af37',
  ENTERPRISE: '#7eb8f7',
};

const s = (style: React.CSSProperties) => style;

export default function SubscriptionPage() {
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [sub,     setSub]     = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // ✅ VM-004: cookie بدل localStorage
    const token = getAccessToken();
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch('/api/subscriptions?endpoint=plans', { credentials: 'include' }),
        fetch('/api/subscriptions?endpoint=status', {
          credentials: 'include',
          headers:     token ? { Authorization: `Bearer ${token}` } : {},
        }),
      ]);
      const plansData = await plansRes.json();
      const subData   = await subRes.json();
      setPlans(plansData.data?.plans ?? []);
      setSub(subData.data?.subscription ?? null);
    } catch {
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (planId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setPaying(planId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/subscriptions?endpoint=subscribe', {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to subscribe');
      setSub(data.data?.subscription);
      setSuccess(`Successfully subscribed to ${planId}!`);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setPaying(null);
    }
  };

  const handleCancel = async () => {
    const token = getAccessToken();
    if (!token) return;
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    try {
      const res = await fetch('/api/subscriptions', {
        method:      'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Cancelled by user' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to cancel');
      setSub(data.data?.subscription);
      setSuccess('Subscription cancelled');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' })}>
        <div style={s({ width: 36, height: 36, border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const currentPlan = sub?.plan ?? 'FREE';
  const color       = PLAN_COLORS[currentPlan] ?? '#6b6b7a';

  return (
    <div style={s({ padding: '24px 16px', maxWidth: 600, margin: '0 auto' })}>

      {/* Header */}
      <div style={s({ marginBottom: 24 })}>
        <h1 style={s({ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 })}>Subscription</h1>
        <p style={s({ fontSize: 13, color: '#6b6b7a', marginTop: 4 })}>Manage your TEC plan</p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={s({ padding: '12px 16px', borderRadius: 12, background: '#1f0505', border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 13, marginBottom: 16 })}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={s({ padding: '12px 16px', borderRadius: 12, background: '#051a0a', border: '1px solid #7ee7c030', color: '#7ee7c0', fontSize: 13, marginBottom: 16 })}>
          ✅ {success}
        </div>
      )}

      {/* Current Plan */}
      <div style={s({ background: 'linear-gradient(135deg,#1a1208,#0f0f1a)', border: `1px solid ${color}30`, borderRadius: 20, padding: '20px 24px', marginBottom: 20 })}>
        <div style={s({ fontSize: 10, color: '#6b6b7a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 })}>Current Plan</div>
        <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
          <div>
            <div style={s({ fontSize: 28, fontWeight: 900, color, lineHeight: 1 })}>{currentPlan}</div>
            <div style={s({ fontSize: 12, color: sub?.status === 'ACTIVE' ? '#7ee7c0' : '#e74c3c', marginTop: 6 })}>
              {sub?.status === 'ACTIVE' ? '● Active' : '● ' + (sub?.status ?? 'Unknown')}
            </div>
          </div>
          <div style={s({ textAlign: 'right' })}>
            <div style={s({ fontSize: 24, fontWeight: 900, color })}>
              {sub?.planDetails?.price === 0 ? 'Free' : `${sub?.planDetails?.price} π`}
            </div>
            {(sub?.planDetails?.duration ?? 0) > 0 && (
              <div style={s({ fontSize: 10, color: '#4a4a5a', marginTop: 4 })}>per month</div>
            )}
          </div>
        </div>
        {sub?.current_period_end && (
          <div style={s({ fontSize: 11, color: '#4a4a5a', marginTop: 12, paddingTop: 12, borderTop: '1px solid #ffffff08' })}>
            Renews: {new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        {sub?.plan !== 'FREE' && sub?.status === 'ACTIVE' && (
          <button onClick={handleCancel}
            style={s({ marginTop: 12, background: 'none', border: '1px solid #e74c3c30', borderRadius: 8, padding: '6px 14px', color: '#e74c3c', fontSize: 11, cursor: 'pointer' })}>
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Plans */}
      <div style={s({ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 })}>
        Available Plans
      </div>
      <div style={s({ display: 'flex', flexDirection: 'column', gap: 12 })}>
        {plans.map(plan => {
          const planColor = PLAN_COLORS[plan.id] ?? '#6b6b7a';
          const isCurrent = plan.id === currentPlan;
          const isUpgrade = plan.price > (sub?.planDetails?.price ?? 0);
          const isLoading = paying === plan.id;

          return (
            <div key={plan.id}
              style={s({ background: '#0d0d14', border: `1px solid ${isCurrent ? planColor + '40' : '#ffffff08'}`, borderRadius: 18, padding: '20px', position: 'relative', overflow: 'hidden' })}>
              {isCurrent && (
                <div style={s({ position: 'absolute', top: 12, right: 12, fontSize: 10, color: planColor, background: planColor + '15', border: `1px solid ${planColor}30`, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 })}>
                  CURRENT
                </div>
              )}
              <div style={s({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 })}>
                <div>
                  <div style={s({ fontSize: 18, fontWeight: 800, color: planColor })}>{plan.name}</div>
                  <div style={s({ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4 })}>
                    {plan.price === 0 ? 'Free' : `${plan.price} π`}
                    {plan.price > 0 && <span style={s({ fontSize: 12, color: '#6b6b7a', fontWeight: 400 })}>/month</span>}
                  </div>
                </div>
              </div>
              <div style={s({ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 })}>
                {plan.features.map((f, i) => (
                  <div key={i} style={s({ display: 'flex', alignItems: 'center', gap: 8 })}>
                    <span style={s({ fontSize: 12, color: planColor })}>✓</span>
                    <span style={s({ fontSize: 12, color: '#6b6b7a' })}>{f}</span>
                  </div>
                ))}
              </div>
              {!isCurrent && plan.id !== 'FREE' && (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!!paying}
                  style={s({
                    width:        '100%',
                    padding:      '12px',
                    borderRadius: 12,
                    background:   isLoading ? planColor + '20' : `linear-gradient(135deg, ${planColor}30, ${planColor}10)`,
                    border:       `1px solid ${planColor}40`,
                    color:        planColor,
                    fontSize:     13,
                    fontWeight:   700,
                    cursor:       paying ? 'not-allowed' : 'pointer',
                  })}>
                  {isLoading
                    ? '⏳ Processing...'
                    : isUpgrade
                      ? `Upgrade to ${plan.name}`
                      : `Switch to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
        }
