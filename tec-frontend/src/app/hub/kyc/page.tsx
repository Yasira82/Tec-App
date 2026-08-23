'use client';

import { useState }                         from 'react';
import { useTranslation, bcp47 }            from '@/lib/i18n';
import type { Translations }                from '@/lib/i18n';
import { useKyc, KycRecord, KycStatus }     from '@/lib-client/hooks/useKyc';
import { HubSubShell }                      from '@/components/hub';
import { DashboardCard }                    from '@/components/dashboard';
import { Icon, IconName }                   from '@/components/ui/Icon';
import { CameraCapture }                     from '@/components/kyc/CameraCapture';

// ── Status config ──────────────────────────────────────────────
const statusConfig = (t: Translations): Record<KycStatus, {
  icon: IconName; label: string; desc: string;
  bg: string; border: string; color: string;
}> => ({
  NOT_STARTED: {
    icon: 'shield', label: t.hub.kyc.status.notStarted, desc: t.hub.kyc.status.notStartedDesc,
    bg: 'rgba(255,255,255,0.03)', border: 'var(--tec-border)', color: 'var(--tec-text-2)',
  },
  PENDING: {
    icon: 'clock', label: t.hub.kyc.status.pending, desc: t.hub.kyc.status.pendingDesc,
    bg: 'rgba(216,136,16,0.08)', border: 'rgba(216,136,16,0.25)', color: 'var(--tec-gold-dark)',
  },
  VERIFIED: {
    icon: 'shieldCheck', label: t.hub.kyc.status.verified, desc: t.hub.kyc.status.verifiedDesc,
    bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', color: 'var(--tec-green)',
  },
  REJECTED: {
    icon: 'x', label: t.hub.kyc.status.rejected, desc: t.hub.kyc.status.rejectedDesc,
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: 'var(--tec-red)',
  },
});

function StatusCard({ kyc }: { kyc: KycRecord }) {
  const { t } = useTranslation();
  const cfg = statusConfig(t)[kyc.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: 'var(--sp-5) var(--sp-6)',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-xl)', marginBottom: 'var(--sp-5)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
      }}>
        <Icon name={cfg.icon} size={24} color={cfg.color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: cfg.color, marginBottom: 4 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
          {cfg.desc}
        </div>
      </div>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 1,
        padding: '4px 14px', borderRadius: 'var(--radius-full)',
        background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)',
        color: 'var(--tec-gold)', flexShrink: 0,
      }}>
        {t.hub.kyc.level} {kyc.level}
      </div>
    </div>
  );
}

// Trust / benefits panel — shown before a user starts. States WHY verification
// matters + that it is secure, the way a professional KYC flow opens.
function VerifyIntro() {
  const { t } = useTranslation();
  const b = t.hub.kyc.benefits;
  const benefits: { icon: IconName; title: string; desc: string }[] = [
    { icon: 'wallet', title: b.accessTitle, desc: b.accessDesc },
    { icon: 'check',  title: b.onceTitle,   desc: b.onceDesc   },
    { icon: 'shield', title: b.secureTitle, desc: b.secureDesc },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-3)',
      marginBottom: 'var(--sp-5)',
    }}>
      {benefits.map(b => (
        <div key={b.title} style={{
          padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)',
          background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)',
          }}>
            <Icon name={b.icon} size={17} color="var(--tec-gold)" />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 3 }}>{b.title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', lineHeight: 1.5 }}>{b.desc}</div>
        </div>
      ))}
    </div>
  );
}

function StepIndicator({ step }: { step: 'docs' | 'review' }) {
  const { t } = useTranslation();
  const steps = [
    { key: 'docs',   label: t.hub.kyc.steps.docs   },
    { key: 'review', label: t.hub.kyc.steps.review },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
      {steps.map((s, i) => {
        const isActive = step === s.key;
        const isDone   = step === 'review' && s.key === 'docs';
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: isDone  ? 'rgba(34,197,94,0.15)'
                          : isActive ? 'var(--tec-gold-dim)'
                          : 'var(--tec-surface-2)',
                border: `1px solid ${isDone  ? 'rgba(34,197,94,0.4)'
                                    : isActive ? 'var(--tec-border-gold)'
                                    : 'var(--tec-border)'}`,
                color: isDone ? 'var(--tec-green)' : isActive ? 'var(--tec-gold)' : 'var(--tec-text-3)',
              }}>
                {isDone ? <Icon name="check" size={14} color="var(--tec-green)" /> : i + 1}
              </div>
              <span style={{
                fontSize: 'var(--text-sm)', fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--tec-text-1)' : 'var(--tec-text-3)',
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: 'var(--tec-border)', margin: '0 var(--sp-3)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KycForm({ kyc, isSubmitting, onUpload, onSubmit }: {
  kyc: KycRecord; isSubmitting: boolean;
  onUpload: (data: { idFrontUrl: string; idBackUrl?: string; selfieUrl: string }) => Promise<void>;
  onSubmit: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [step,       setStep]       = useState<'docs' | 'review'>(kyc.id_front_url ? 'review' : 'docs');
  const [idFrontUrl, setIdFrontUrl] = useState(kyc.id_front_url ?? '');
  const [idBackUrl,  setIdBackUrl]  = useState(kyc.id_back_url  ?? '');
  const [selfieUrl,  setSelfieUrl]  = useState(kyc.selfie_url   ?? '');
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);

  const handleUpload = async () => {
    if (!idFrontUrl || !selfieUrl) { setUploadErr(t.hub.kyc.upload.required); return; }
    setUploading(true); setUploadErr(null);
    try {
      await onUpload({ idFrontUrl, idBackUrl: idBackUrl || undefined, selfieUrl });
      setStep('review');
    } catch (err: unknown) { setUploadErr((err as Error).message); }
    finally { setUploading(false); }
  };

  const reviewItems = [
    { label: t.hub.kyc.review.idFront, value: kyc.id_front_url, required: true  },
    { label: t.hub.kyc.review.idBack,  value: kyc.id_back_url,  required: false },
    { label: t.hub.kyc.review.selfie,  value: kyc.selfie_url,   required: true  },
  ];

  return (
    <DashboardCard>
      <StepIndicator step={step} />

      {step === 'docs' && (
        <div>
          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
              {t.hub.kyc.upload.heading}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.6 }}>
              {t.hub.kyc.upload.help}
            </div>
          </div>

          <CameraCapture label={t.hub.kyc.upload.frontLabel} required facing="environment" guide="rect"
            title={t.hub.kyc.upload.frontTitle} hint={t.hub.kyc.upload.frontHint}
            initialValue={kyc.id_front_url} onChange={setIdFrontUrl} />
          <CameraCapture label={t.hub.kyc.upload.backLabel} facing="environment" guide="rect"
            title={t.hub.kyc.upload.backTitle} hint={t.hub.kyc.upload.backHint}
            initialValue={kyc.id_back_url} onChange={setIdBackUrl} />
          <CameraCapture label={t.hub.kyc.upload.selfieLabel} required facing="user" guide="oval"
            title={t.hub.kyc.upload.selfieTitle} hint={t.hub.kyc.upload.selfieHint}
            initialValue={kyc.selfie_url} onChange={setSelfieUrl} />

          {uploadErr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--tec-red)' }}>
              <Icon name="alert" size={16} color="var(--tec-red)" /> {uploadErr}
            </div>
          )}

          {/* Security reassurance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-5)', fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>
            <Icon name="shield" size={14} color="var(--tec-green)" />
            {t.hub.kyc.upload.encrypted}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleUpload} disabled={uploading || !idFrontUrl || !selfieUrl}
              style={{
                padding: '12px 28px', borderRadius: 'var(--radius-md)',
                background: (!idFrontUrl || !selfieUrl) ? 'var(--tec-surface-3)' : 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))',
                border: 'none', color: '#0a0800', fontWeight: 700, fontSize: 'var(--text-sm)',
                cursor: (!idFrontUrl || !selfieUrl) ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.6 : 1,
              }}>
              {uploading ? t.hub.kyc.upload.uploading : `${t.hub.kyc.upload.continue} →`}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-5)' }}>
            {t.hub.kyc.review.heading}
          </div>

          <div style={{ border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
            {reviewItems.map((item, i) => {
              const state = item.value ? 'ok' : item.required ? 'missing' : 'optional';
              const color = state === 'ok' ? 'var(--tec-green)' : state === 'missing' ? 'var(--tec-red)' : 'var(--tec-text-3)';
              return (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--sp-3) var(--sp-5)',
                  borderBottom: i < reviewItems.length - 1 ? '1px solid var(--tec-border)' : 'none',
                  background: 'var(--tec-surface-1)',
                }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)' }}>{item.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, color }}>
                    <Icon name={state === 'ok' ? 'check' : state === 'missing' ? 'x' : 'info'} size={15} color={color} />
                    {state === 'ok' ? t.hub.kyc.review.uploaded : state === 'missing' ? t.hub.kyc.review.missing : t.hub.kyc.review.optional}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)',
            background: 'rgba(248,184,32,0.05)', border: '1px solid var(--tec-border-gold)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.6,
          }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><Icon name="info" size={16} color="var(--tec-gold)" /></span>
            {t.hub.kyc.review.confirm}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
            <button onClick={() => setStep('docs')}
              style={{ padding: '11px 20px', borderRadius: 'var(--radius-md)', background: 'transparent', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              ← {t.hub.kyc.review.back}
            </button>
            <button onClick={onSubmit} disabled={isSubmitting}
              style={{
                padding: '11px 28px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))',
                border: 'none', color: '#0a0800', fontWeight: 700,
                fontSize: 'var(--text-sm)', cursor: 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}>
              {isSubmitting ? t.hub.kyc.review.submitting : t.hub.kyc.review.submit}
            </button>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}

// Centered icon badge for the terminal states.
// `edge` is passed rather than derived: the icon colour is a design token now, and
// a token cannot carry an appended alpha (`var(--x)33` is not a colour).
function StateBadge({ icon, color, ring, edge }: { icon: IconName; color: string; ring: string; edge: string }) {
  return (
    <div style={{
      width: 68, height: 68, borderRadius: 20, margin: '0 auto var(--sp-4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: ring, border: `1px solid ${edge}`,
    }}>
      <Icon name={icon} size={34} color={color} strokeWidth={1.8} />
    </div>
  );
}

function PendingState() {
  const { t } = useTranslation();
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
        <StateBadge icon="clock" color="var(--tec-gold-dark)" ring="rgba(216,136,16,0.1)" edge="rgba(216,136,16,0.2)" />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-3)' }}>
          {t.hub.kyc.pending.heading}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
          {t.hub.kyc.pending.body}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260, margin: 'var(--sp-6) auto 0' }}>
          {[
            { label: t.hub.kyc.pending.submitted,  state: 'done' },
            { label: t.hub.kyc.pending.inProgress, state: 'active' },
            { label: t.hub.kyc.pending.decision,   state: 'todo' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)', color: s.state === 'done' ? 'var(--tec-green)' : s.state === 'active' ? 'var(--tec-gold-dark)' : 'var(--tec-text-3)' }}>
              {s.state === 'done'
                ? <Icon name="check" size={16} color="var(--tec-green)" />
                : <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${s.state === 'active' ? 'var(--tec-gold-dark)' : 'var(--tec-border)'}`, background: s.state === 'active' ? 'var(--tec-gold-dark)' : 'transparent', flexShrink: 0 }} />}
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function VerifiedState({ kyc }: { kyc: KycRecord }) {
  const { t, locale } = useTranslation();
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
        <StateBadge icon="shieldCheck" color="var(--tec-green)" ring="rgba(34,197,94,0.1)" edge="rgba(34,197,94,0.2)" />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--tec-green)', marginBottom: 'var(--sp-3)' }}>
          {t.hub.kyc.verified.heading}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.7, marginBottom: 'var(--sp-6)' }}>
          {t.hub.kyc.verified.body}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-8)', justifyContent: 'center' }}>
          {[
            { label: t.hub.kyc.level, value: kyc.level },
            { label: t.hub.kyc.verified.verifiedOn,
              // The date follows the interface language too — an Arabic screen showing
              // "Mar 2026" is the same half-translation this change is undoing.
              value: kyc.verified_at
                ? new Date(kyc.verified_at).toLocaleDateString(bcp47(locale), { month: 'short', year: 'numeric' })
                : '—' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--tec-gold)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function RejectedState({ reason, isSubmitting, onReset }: {
  reason?: string | null; isSubmitting: boolean; onReset: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-6)' }}>
        <StateBadge icon="x" color="var(--tec-red)" ring="rgba(239,68,68,0.1)" edge="rgba(239,68,68,0.2)" />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>
          {t.hub.kyc.rejected.heading}
        </div>
        {reason && (
          <div style={{
            padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)', lineHeight: 1.6, textAlign: 'start',
          }}>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--tec-red)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{t.hub.kyc.rejected.reason}</span>
            {reason}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-6)', lineHeight: 1.6 }}>
          {t.hub.kyc.rejected.body}
        </div>
        <button onClick={onReset} disabled={isSubmitting}
          style={{
            padding: '12px 32px', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))',
            border: 'none', color: '#0a0800', fontWeight: 700,
            fontSize: 'var(--text-sm)', cursor: 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}>
          {isSubmitting ? t.hub.kyc.rejected.resetting : `${t.hub.kyc.rejected.tryAgain} →`}
        </button>
      </div>
    </DashboardCard>
  );
}

export default function HubKycPage() {
  const { t } = useTranslation();
  const { kyc, isLoading, isSubmitting, error, uploadDocs, submit, reset } = useKyc();

  const badge = kyc ? {
    NOT_STARTED: { text: t.hub.kyc.badge.notStarted, color: 'blue'  as const },
    PENDING:     { text: t.hub.kyc.badge.pending,    color: 'gold'  as const },
    VERIFIED:    { text: t.hub.kyc.badge.verified,   color: 'green' as const },
    REJECTED:    { text: t.hub.kyc.badge.rejected,   color: 'red'   as const },
  }[kyc.status] : undefined;

  return (
    <HubSubShell
      title={t.hub.kyc.title}
      subtitle={t.hub.kyc.subtitle}
      badge={badge}
      loading={isLoading}
    >
      {kyc && <StatusCard kyc={kyc} />}

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: 'var(--sp-3) var(--sp-5)', marginBottom: 'var(--sp-4)',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--tec-red)',
        }}>
          <Icon name="alert" size={16} color="var(--tec-red)" /> {error}
        </div>
      )}

      {kyc?.status === 'NOT_STARTED' && (
        <>
          <VerifyIntro />
          <KycForm kyc={kyc} isSubmitting={isSubmitting} onUpload={uploadDocs} onSubmit={submit} />
        </>
      )}
      {kyc?.status === 'REJECTED' && (
        <RejectedState reason={kyc.rejection_reason} isSubmitting={isSubmitting} onReset={reset} />
      )}
      {kyc?.status === 'PENDING'  && <PendingState />}
      {kyc?.status === 'VERIFIED' && <VerifiedState kyc={kyc} />}
    </HubSubShell>
  );
}
