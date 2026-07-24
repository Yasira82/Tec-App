'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon }           from '@/components/ui/Icon';
import { uploadKycImage } from '@/lib-client/kyc/upload-image';

interface Props {
  label:         string;
  required?:     boolean;
  /** Pre-existing value from the KYC record (a storage key) — shown as "captured". */
  initialValue?: string | null;
  /** Called with the durable storage key once the selfie is uploaded (or '' when cleared). */
  onChange:      (key: string) => void;
}

type State = 'idle' | 'uploading' | 'done' | 'error';

const hasLiveCamera = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

// A true in-app live selfie camera (like the big KYC platforms): tapping the
// tile opens the phone's FRONT camera inside the app, shows a live mirrored
// preview, and captures the face on a button press — no leaving the app, no
// bare file picker. The captured frame is uploaded to secure storage and the
// storage key is reported up.
//
// A hidden native <input type="file" capture="user"> is kept as a fallback for
// browsers that block getUserMedia (permission denied / insecure context) and
// so the platform still has a camera path everywhere.
export function LiveSelfieCapture({ label, required, initialValue, onChange }: Props) {
  const [state,   setState]   = useState<State>(initialValue ? 'done' : 'idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [err,     setErr]     = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camErr,  setCamErr]  = useState<string | null>(null);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Always release the camera when the modal closes or the component unmounts.
  useEffect(() => () => stopStream(), [stopStream]);

  const uploadFile = useCallback(async (file: File) => {
    setErr(null);
    setState('uploading');
    try { setPreview(URL.createObjectURL(file)); } catch { /* non-image / SSR */ }
    try {
      const { key } = await uploadKycImage(file);
      onChange(key);
      setState('done');
    } catch (e: unknown) {
      setErr((e as Error).message || 'Upload failed');
      setState('error');
      onChange('');
    }
  }, [onChange]);

  const openCamera = useCallback(async () => {
    if (!hasLiveCamera()) { fileRef.current?.click(); return; }
    setCamErr(null);
    setCamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay guard */ });
      }
    } catch (e: unknown) {
      // Permission denied / no camera / insecure context → offer the file fallback.
      setCamErr((e as Error)?.message || 'Camera unavailable');
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopStream();
    setCamOpen(false);
    setCamErr(null);
  }, [stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Draw the true (un-mirrored) frame — the preview is mirrored only so it
    // feels natural to the user; the stored evidence keeps real orientation.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) { setCamErr('Could not capture the frame — try again'); return; }
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeCamera();
        void uploadFile(file);
      },
      'image/jpeg',
      0.92,
    );
  }, [closeCamera, uploadFile]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadFile(file);
  };

  const borderColor =
    state === 'done'  ? 'rgba(34,197,94,0.4)'
  : state === 'error' ? 'rgba(239,68,68,0.4)'
  : 'var(--tec-border)';

  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--tec-text-2)', marginBottom: 8, letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      {/* The tile OPENS the live camera (not a file picker). */}
      <button
        type="button"
        onClick={openCamera}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left', cursor: 'pointer',
          background: 'var(--tec-surface-1)', border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
        }}>
        <div style={{
          width: 46, height: 46, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
        }}>
          {preview
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not an optimizable asset
            ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name={state === 'done' ? 'check' : 'camera'} size={20} color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {state === 'uploading' ? (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>Uploading…</span>
          ) : state === 'done' ? (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>Selfie captured</div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#22C55E' }}>Done · tap to retake</div>
            </>
          ) : state === 'error' ? (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: 600 }}>Upload failed</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err} · tap to retry</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>Take a live selfie</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>Opens your front camera · look straight at it</div>
            </>
          )}
        </div>

        <Icon name={state === 'done' ? 'check' : 'camera'} size={16}
          color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} style={{ flexShrink: 0 }} />
      </button>

      {/* Hidden fallback: keeps a camera path when getUserMedia is blocked, and
          preserves a native selfie <input> for automated coverage. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={onFile}
        aria-label={label}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Live camera modal */}
      {camOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--sp-5)',
          }}>
          {camErr ? (
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <Icon name="camera" size={26} color="#ef4444" />
              </div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff', marginBottom: 8 }}>Camera unavailable</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', marginBottom: 'var(--sp-5)' }}>{camErr}</div>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center' }}>
                <button type="button" onClick={closeCamera}
                  style={{ padding: '11px 20px', borderRadius: 'var(--radius-md)', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={() => { closeCamera(); fileRef.current?.click(); }}
                  style={{ padding: '11px 20px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg,var(--tec-gold),#F59E0B)', border: 'none', color: '#1a1200', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  Upload a photo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                position: 'relative', width: '100%', maxWidth: 400, aspectRatio: '3 / 4',
                borderRadius: 20, overflow: 'hidden', background: '#000',
                border: '2px solid rgba(255,255,255,0.15)',
              }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                {/* Oval face guide */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: '62%', height: '74%', border: '2px dashed rgba(255,255,255,0.55)',
                  borderRadius: '50%', pointerEvents: 'none',
                }} />
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)', margin: 'var(--sp-4) 0' }}>
                Center your face in the oval, then capture
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                <button type="button" onClick={closeCamera}
                  style={{ padding: '12px 22px', borderRadius: 999, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={capture} aria-label="Capture selfie"
                  style={{
                    width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
                    background: '#fff', border: '4px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 0 0 2px #fff inset',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Icon name="camera" size={26} color="#111" />
                </button>
                <span style={{ width: 68 }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
