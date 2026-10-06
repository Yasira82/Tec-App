'use client';

import { useTranslation } from '@/lib/i18n';
import { usePiAuth }      from '@/lib-client/hooks/usePiAuth';
import { HubSubShell }    from '@/components/hub';
import { Icon }           from '@/components/ui/Icon';
import { LifeAiCard }     from './LifeAiCard';
import { IntentReviewCard } from './IntentReviewCard';

/**
 * /hub/admin/life-ai — the two numbers that gate every Life/AI expansion (M1).
 * `role === 'admin'` hides it; identity-service and analytics-service enforce it
 * (each refuses a non-admin token, and the BFF passes that refusal through).
 */
export default function AdminLifeAiPage() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const s = t.hub.adminLifeAi;

  return (
    <HubSubShell title={s.title} subtitle={s.subtitle} loading={authLoading} backTo="/hub/profile">
      {(!authLoading && !isAdmin) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto var(--sp-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <Icon name="shield" size={28} color="var(--tec-red)" />
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>{s.restricted}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>{s.restrictedSub}</div>
        </div>
      ) : (
        <>
          <LifeAiCard strings={s} />
          <IntentReviewCard strings={s.intents} />
        </>
      )}
    </HubSubShell>
  );
}
