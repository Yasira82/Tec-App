'use client';

import { useState } from 'react';
import { useKyc, KycRecord, KycStatus } from '@/lib-client/hooks/useKyc';
import styles from './kyc.module.css';

// ─── Status Config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<KycStatus, {
  icon: string; label: string; css: string; desc: string;
}> = {
  NOT_STARTED: {
    icon: '📋', label: 'Not Started',
    css:  'statusNotStarted',
    desc: 'Complete your identity verification to unlock all features.',
  },
  PENDING: {
    icon: '⏳', label: 'Under Review',
    css:  'statusPending',
    desc: 'Your documents are being reviewed. This usually takes 1-2 business days.',
  },
  VERIFIED: {
    icon: '✅', label: 'Verified',
    css:  'statusVerified',
    desc: 'Your identity has been successfully verified.',
  },
  REJECTED: {
    icon: '❌', label: 'Rejected',
    css:  'statusRejected',
    desc: 'Your verification was rejected. Please resubmit with correct documents.',
  },
};

// ─── Page ──────────────────────────────────────────────────────
export default function KycPage() {
  const { kyc, isLoading, isSubmitting, error, uploadDocs, submit, reset } = useKyc();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <KycSkeleton />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Identity Verification</h1>
        <p className={styles.subtitle}>KYC — Know Your Customer</p>
      </header>

      {/* ── Status Card ── */}
      {kyc && <StatusCard kyc={kyc} />}

      {/* ── Error ── */}
      {error && (
        <div className={styles.errorBanner}>⚠️ {error}</div>
      )}

      {/* ── Content by status ── */}
      {kyc?.status === 'NOT_STARTED' && (
        <KycForm
          kyc={kyc}
          isSubmitting={isSubmitting}
          onUpload={uploadDocs}
          onSubmit={submit}
        />
      )}

      {kyc?.status === 'REJECTED' && (
        <RejectedState
          reason={kyc.rejection_reason}
          isSubmitting={isSubmitting}
          onReset={reset}
        />
      )}

      {kyc?.status === 'PENDING' && <PendingState />}
      {kyc?.status === 'VERIFIED' && <VerifiedState kyc={kyc} />}
    </div>
  );
}

// ─── Status Card ───────────────────────────────────────────────
function StatusCard({ kyc }: { kyc: KycRecord }) {
  const cfg = STATUS_CONFIG[kyc.status];
  return (
    <div className={`${styles.statusCard} ${styles[cfg.css]}`}>
      <span className={styles.statusIcon}>{cfg.icon}</span>
      <div className={styles.statusInfo}>
        <div className={styles.statusLabel}>{cfg.label}</div>
        <div className={styles.statusDesc}>{cfg.desc}</div>
      </div>
      <div className={styles.levelBadge}>Level {kyc.level}</div>
    </div>
  );
}

// ─── KYC Form ──────────────────────────────────────────────────
function KycForm({
  kyc, isSubmitting, onUpload, onSubmit,
}: {
  kyc:          KycRecord;
  isSubmitting: boolean;
  onUpload:     (data: any) => Promise<void>;
  onSubmit:     () => Promise<void>;
}) {
  const [step, setStep] = useState<'docs' | 'review'>(
    kyc.id_front_url ? 'review' : 'docs'
  );
  const [idFrontUrl, setIdFrontUrl] = useState(kyc.id_front_url ?? '');
  const [idBackUrl,  setIdBackUrl]  = useState(kyc.id_back_url  ?? '');
  const [selfieUrl,  setSelfieUrl]  = useState(kyc.selfie_url   ?? '');
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);

  const handleUpload = async () => {
    if (!idFrontUrl || !selfieUrl) {
      setUploadErr('ID front and selfie are required');
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      await onUpload({ idFrontUrl, idBackUrl: idBackUrl || undefined, selfieUrl });
      setStep('review');
    } catch (err: any) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`${styles.formSection} fade-up`}>
      {/* Steps */}
      <div className={styles.steps}>
        <div className={`${styles.step} ${step === 'docs' ? styles.stepActive : styles.stepDone}`}>
          <span className={styles.stepNum}>1</span>
          <span>Upload Documents</span>
        </div>
        <div className={styles.stepLine} />
        <div className={`${styles.step} ${step === 'review' ? styles.stepActive : ''}`}>
          <span className={styles.stepNum}>2</span>
          <span>Review & Submit</span>
        </div>
      </div>

      {step === 'docs' && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Upload Your Documents</h2>
          <p className={styles.formHint}>
            Provide valid document URLs. In production, integrate with your storage service.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              ID Front <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              type="url"
              placeholder="https://..."
              value={idFrontUrl}
              onChange={e => setIdFrontUrl(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>ID Back (optional)</label>
            <input
              className={styles.input}
              type="url"
              placeholder="https://..."
              value={idBackUrl}
              onChange={e => setIdBackUrl(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Selfie with ID <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              type="url"
              placeholder="https://..."
              value={selfieUrl}
              onChange={e => setSelfieUrl(e.target.value)}
            />
          </div>

          {uploadErr && <div className={styles.fieldError}>{uploadErr}</div>}

          <button
            className={styles.btnPrimary}
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Continue →'}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Review & Submit</h2>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>ID Front</span>
              <span className={`${styles.reviewValue} ${kyc.id_front_url ? styles.reviewOk : styles.reviewMissing}`}>
                {kyc.id_front_url ? '✓ Uploaded' : '✗ Missing'}
              </span>
            </div>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>ID Back</span>
              <span className={`${styles.reviewValue} ${kyc.id_back_url ? styles.reviewOk : styles.reviewOptional}`}>
                {kyc.id_back_url ? '✓ Uploaded' : '— Optional'}
              </span>
            </div>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Selfie</span>
              <span className={`${styles.reviewValue} ${kyc.selfie_url ? styles.reviewOk : styles.reviewMissing}`}>
                {kyc.selfie_url ? '✓ Uploaded' : '✗ Missing'}
              </span>
            </div>
          </div>

          <div className={styles.reviewNotice}>
            <span>ℹ️</span>
            <p>Once submitted, your documents will be reviewed by our team within 1-2 business days.</p>
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.btnOutline}
              onClick={() => setStep('docs')}
              disabled={isSubmitting}
            >
              ← Edit Documents
            </button>
            <button
              className={styles.btnPrimary}
              onClick={onSubmit}
              disabled={isSubmitting || !kyc.id_front_url || !kyc.selfie_url}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending State ─────────────────────────────────────────────
function PendingState() {
  return (
    <div className={`${styles.stateCard} fade-up`}>
      <div className={styles.stateIcon}>⏳</div>
      <h2 className={styles.stateTitle}>Under Review</h2>
      <p className={styles.stateDesc}>
        Your documents have been submitted and are currently being reviewed.
        You will be notified once the review is complete.
      </p>
      <div className={styles.stateTimeline}>
        <div className={`${styles.timelineItem} ${styles.timelineDone}`}>
          <span>✓</span> Documents Submitted
        </div>
        <div className={`${styles.timelineItem} ${styles.timelineActive}`}>
          <span>⏳</span> Under Review
        </div>
        <div className={styles.timelineItem}>
          <span>○</span> Decision
        </div>
      </div>
    </div>
  );
}

// ─── Verified State ────────────────────────────────────────────
function VerifiedState({ kyc }: { kyc: KycRecord }) {
  return (
    <div className={`${styles.stateCard} ${styles.stateCardVerified} fade-up`}>
      <div className={styles.stateIcon}>✅</div>
      <h2 className={styles.stateTitle}>Identity Verified</h2>
      <p className={styles.stateDesc}>
        Your identity has been successfully verified. You now have full access to all TEC features.
      </p>
      <div className={styles.verifiedMeta}>
        <div className={styles.verifiedItem}>
          <span className={styles.verifiedLabel}>Level</span>
          <span className={styles.verifiedValue}>{kyc.level}</span>
        </div>
        {kyc.verified_at && (
          <div className={styles.verifiedItem}>
            <span className={styles.verifiedLabel}>Verified</span>
            <span className={styles.verifiedValue}>
              {new Date(kyc.verified_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rejected State ────────────────────────────────────────────
function RejectedState({
  reason, isSubmitting, onReset,
}: {
  reason:       string | null;
  isSubmitting: boolean;
  onReset:      () => void;
}) {
  return (
    <div className={`${styles.stateCard} ${styles.stateCardRejected} fade-up`}>
      <div className={styles.stateIcon}>❌</div>
      <h2 className={styles.stateTitle}>Verification Rejected</h2>
      {reason && (
        <div className={styles.rejectionReason}>
          <span className={styles.rejectionLabel}>Reason:</span>
          <span className={styles.rejectionText}>{reason}</span>
        </div>
      )}
      <p className={styles.stateDesc}>
        Please review the rejection reason and resubmit with the correct documents.
      </p>
      <button
        className={styles.btnPrimary}
        onClick={onReset}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Please wait...' : 'Resubmit KYC →'}
      </button>
    </div>
  );
}

function KycSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonStatus} />
      <div className={styles.skeletonForm} />
    </div>
  );
}
