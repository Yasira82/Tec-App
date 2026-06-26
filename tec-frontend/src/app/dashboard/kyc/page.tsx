'use client';

import { useState }                         from 'react';
import { useKyc, KycRecord, KycStatus }     from '@/lib-client/hooks/useKyc';
import { DashboardShell, DashboardCard }    from '@/components/dashboard';

// ── Status config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<KycStatus, {
  icon: string; label: string; desc: string;
  bg: string; border: string; color: string;
}> = {
  NOT_STARTED: {
    icon: '📋', label: 'Not Started',
    desc: 'Complete your identity verification to unlock all TEC features.',
    bg: 'rgba(255,255,255,0.03)', border: 'var(--tec-border)', color: 'var(--tec-text-2)',
  },
  PENDING: {
    icon: '⏳', label: 'Under Review',
    desc: 'Your documents are being reviewed. This usually takes 1–2 business days.',
    bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', color: '#f59e0b',
  },
  VERIFIED: {
    icon: '✅', label: 'Verified',
    desc: 'Your identity has been successfully verified.',
    bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', color: '#22C55E',
  },
  REJECTED: {
    icon: '❌', label: 'Rejected',
    desc: 'Your verification was rejected. Please resubmit with correct documents.',
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: '#ef4444',
  },
};

// ── Status Card ────────────────────────────────────────────────
function StatusCard({ kyc }: { kyc: KycRecord }) {
  const cfg = STATUS_CONFIG[kyc.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: 'var(--sp-5) var(--sp-6)',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-xl)', marginBottom: 'var(--sp-5)',
    }}>
      <span style={{ fontSize: 36, flexShrink: 0 }}>{cfg.icon}</span>
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
        Level {kyc.level}
      </div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────
function StepIndicator({ step }: { step: 'docs' | 'review' }) {
  const steps = [
    { key: 'docs',   label: 'Upload Documents' },
    { key: 'review', label: 'Review & Submit' },
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
                color: isDone ? '#22C55E' : isActive ? 'var(--tec-gold)' : 'var(--tec-text-3)',
              }}>
                {isDone ? '✓' : i + 1}
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

// ── Field ──────────────────────────────────────────────────────
function Field({ label, required, value, onChange, placeholder }: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--tec-text-2)', marginBottom: 8, letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'https://...'}
        style={{
          width: '100%', padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--tec-surface-1)',
          border: '1px solid var(--tec-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--tec-text-1)', fontSize: 'var(--text-sm)',
          outline: 'none', boxSizing: 'border-box',
          fontFamily: 'var(--font-sans)',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(251,191,36,0.4)'; }}
        onBlur={e  => { e.target.style.borderColor = 'var(--tec-border)'; }}
      />
    </div>
  );
}

// ── KYC Form ───────────────────────────────────────────────────
function KycForm({ kyc, isSubmitting, onUpload, onSubmit }: {
  kyc: KycRecord; isSubmitting: boolean;
  onUpload: (data: { idFrontUrl: string; idBackUrl?: string; selfieUrl: string }) => Promise<void>;
  onSubmit: () => Promise<void>;
}) {
  const [step,       setStep]       = useState<'docs' | 'review'>(kyc.id_front_url ? 'review' : 'docs');
  const [idFrontUrl, setIdFrontUrl] = useState(kyc.id_front_url ?? '');
  const [idBackUrl,  setIdBackUrl]  = useState(kyc.id_back_url  ?? '');
  const [selfieUrl,  setSelfieUrl]  = useState(kyc.selfie_url   ?? '');
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);

  const handleUpload = async () => {
    if (!idFrontUrl || !selfieUrl) { setUploadErr('ID front and selfie are required'); return; }
    setUploading(true); setUploadErr(null);
    try {
      await onUpload({ idFrontUrl, idBackUrl: idBackUrl || undefined, selfieUrl });
      setStep('review');
    } catch (err: unknown) { setUploadErr((err as Error).message); }
    finally { setUploading(false); }
  };

  const reviewItems = [
    { label: 'ID Front',  value: kyc.id_front_url, required: true },
    { label: 'ID Back',   value: kyc.id_back_url,  required: false },
    { label: 'Selfie',    value: kyc.selfie_url,   required: true },
  ];

  return (
    <DashboardCard>
      <StepIndicator step={step} />

      {step === 'docs' && (
        <div>
          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
              Upload Your Documents
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.6 }}>
              Provide valid document URLs. Ensure images are clear and not expired.
            </div>
          </div>

          <Field label="ID Front" required value={idFrontUrl} onChange={setIdFrontUrl} placeholder="https://storage/id-front.jpg" />
          <Field label="ID Back (optional)" value={idBackUrl} onChange={setIdBackUrl} placeholder="https://storage/id-back.jpg" />
          <Field label="Selfie with ID" required value={selfieUrl} onChange={setSelfieUrl} placeholder="https://storage/selfie.jpg" />

          {uploadErr && (
            <div style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: '#ef4444' }}>
              ⚠️ {uploadErr}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleUpload} disabled={uploading || !idFrontUrl || !selfieUrl}
              style={{
                padding: '12px 28px', borderRadius: 'var(--radius-md)',
                background: (!idFrontUrl || !selfieUrl) ? 'var(--tec-surface-3)' : 'linear-gradient(135deg,#FBBF24,#F59E0B)',
                border: 'none', color: '#0a0800', fontWeight: 700, fontSize: 'var(--text-sm)',
                cursor: (!idFrontUrl || !selfieUrl) ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.6 : 1,
              }}>
              {uploading ? 'Uploading…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-5)' }}>
            Review & Submit
          </div>

          <div style={{ border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
            {reviewItems.map((item, i) => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--sp-3) var(--sp-5)',
                borderBottom: i < reviewItems.length - 1 ? '1px solid var(--tec-border)' : 'none',
                background: 'var(--tec-surface-1)',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)' }}>{item.label}</span>
                <span style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: item.value ? '#22C55E' : item.required ? '#ef4444' : 'var(--tec-text-3)',
                }}>
                  {item.value ? '✓ Uploaded' : item.required ? '✗ Missing' : '— Optional'}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)',
            background: 'rgba(251,191,36,0.05)', border: '1px solid var(--tec-border-gold)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.6,
          }}>
            ℹ️ By submitting, you confirm these documents are authentic and belong to you.
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
            <button onClick={() => setStep('docs')}
              style={{ padding: '11px 20px', borderRadius: 'var(--radius-md)', background: 'transparent', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={onSubmit} disabled={isSubmitting}
              style={{
                padding: '11px 28px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
                border: 'none', color: '#0a0800', fontWeight: 700,
                fontSize: 'var(--text-sm)', cursor: 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}>
              {isSubmitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}

// ── Pending State ───────────────────────────────────────────────
function PendingState() {
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>⏳</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-3)' }}>
          Under Review
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
          Your documents are being reviewed by our team. You&apos;ll receive a notification once complete — usually within 1–2 business days.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 240, margin: 'var(--sp-6) auto 0' }}>
          {['Documents submitted', 'Manual review in progress', 'Decision notification'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)', color: i === 0 ? '#22C55E' : i === 1 ? '#f59e0b' : 'var(--tec-text-3)' }}>
              <span>{i === 0 ? '✓' : i === 1 ? '◉' : '○'}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

// ── Verified State ─────────────────────────────────────────────
function VerifiedState({ kyc }: { kyc: KycRecord }) {
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>✅</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#22C55E', marginBottom: 'var(--sp-3)' }}>
          Identity Verified
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.7, marginBottom: 'var(--sp-6)' }}>
          Your identity has been verified. You now have full access to all TEC features.
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-8)', justifyContent: 'center' }}>
          {[
            { label: 'Level',    value: kyc.level },
            { label: 'Verified', value: kyc.verified_at ? new Date(kyc.verified_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—' },
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

// ── Rejected State ─────────────────────────────────────────────
function RejectedState({ reason, isSubmitting, onReset }: {
  reason?: string | null; isSubmitting: boolean; onReset: () => void | Promise<void>;
}) {      
  return (
    <DashboardCard>
      <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-6)' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>❌</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#ef4444', marginBottom: 'var(--sp-3)' }}>
          Verification Rejected
        </div>
        {reason && (
          <div style={{
            padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)', lineHeight: 1.6,
          }}>
            <span style={{ display: 'block', fontSize: 10, color: '#ef4444', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Reason</span>
            {reason}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-6)', lineHeight: 1.6 }}>
          Please resubmit with clearer, valid documents.
        </div>
        <button onClick={onReset} disabled={isSubmitting}
          style={{
            padding: '12px 32px', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
            border: 'none', color: '#0a0800', fontWeight: 700,
            fontSize: 'var(--text-sm)', cursor: 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}>
          {isSubmitting ? 'Resetting…' : 'Try Again →'}
        </button>
      </div>
    </DashboardCard>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function KycPage() {
  const { kyc, isLoading, isSubmitting, error, uploadDocs, submit, reset } = useKyc();

  const badge = kyc ? {
    NOT_STARTED: { text: 'Action Required', color: 'blue'  as const },
    PENDING:     { text: 'Under Review',    color: 'gold'  as const },
    VERIFIED:    { text: 'Verified',        color: 'green' as const },
    REJECTED:    { text: 'Rejected',        color: 'red'   as const },
  }[kyc.status] : undefined;

  return (
    <DashboardShell
      title="Identity Verification"
      subtitle="KYC — Know Your Customer"
      badge={badge}
      loading={isLoading}
    >
      {kyc && <StatusCard kyc={kyc} />}

      {error && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-5)', marginBottom: 'var(--sp-4)',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#ef4444',
        }}>
          ⚠️ {error}
        </div>
      )}

      {kyc?.status === 'NOT_STARTED' && (
        <KycForm kyc={kyc} isSubmitting={isSubmitting} onUpload={uploadDocs} onSubmit={submit} />
      )}
      {kyc?.status === 'REJECTED' && (
        <RejectedState reason={kyc.rejection_reason} isSubmitting={isSubmitting} onReset={reset} />
      )}
      {kyc?.status === 'PENDING'   && <PendingState />}
      {kyc?.status === 'VERIFIED'  && <VerifiedState kyc={kyc} />}
    </DashboardShell>
  );
            }
