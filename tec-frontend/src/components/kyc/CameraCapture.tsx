'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon }           from '@/components/ui/Icon';
import { uploadKycImage } from '@/lib-client/kyc/upload-image';

interface Props {
  label:         string;
  required?:     boolean;
  /** Pre-existing value from the KYC record (a storage key) — shown as "captured". */
  initialValue?: string | null;
  /** Called with the durable storage key once the image is uploaded (or '' when cleared). */
  onChange:      (key: string) => void;
  /** 'user' = front camera (selfie), 'environment' = rear camera (documents). */
  facing?:       'user' | 'environment';
  /** Face oval vs document rectangle guide in the live view. */
  guide?:        'oval' | 'rect';
  /** Idle tile copy. */
  title?:        string;
  hint?:         string;
}

type State = 'idle' | 'uploading' | 'done' | 'error';

// getUserMedia only works in a SECURE context with the API present. Some mobile
// webviews block the native file picker but DO allow getUserMedia (and vice
// versa) — so we make the in-app live camera the PRIMARY path when available,
// and always keep the native <input capture> as a fallback. One of the two
// works in every environment we've seen.
const hasLiveCamera = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function' &&
  typeof window !== 'undefined' &&
  window.isSecureContext === true;

// If the camera doesn't start within this window we stop waiting, so the
// full-screen modal can NEVER hang black on top of the rest of the form.
const CAMERA_START_TIMEOUT_MS = 8000;

// Unified KYC capture tile used for ID front, ID back and the selfie.
//
// Tap the tile → opens the in-app live camera (getUserMedia) when it can run,
// draws the frame to a canvas and uploads it. Where getUserMedia is blocked it
// falls back to the native <input capture> (phone camera). A small "upload a
// file" link is always available for picking an existing image.
export function CameraCapture({
  label, required, initialValue, onChange,
  facing = 'environment', guide = 'rect',
  title = 'Take a photo', hint = 'Opens your camera',
}: Props) {
  const [state,    setState]    = useState<State>(initialValue ? 'done' : 'idle');
  const [preview,  setPreview]  = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);
  const [camOpen,  setCamOpen]  = useState(false);
  const [camErr,   setCamErr]   = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide the live-camera path only AFTER mount — hasLiveCamera() is false
  // during SSR, so gating render on it directly would cause a hydration mismatch.
  useEffect(() => { setMounted(true); }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => { clearWatchdog(); stopStream(); }, [clearWatchdog, stopStream]);

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

  const closeCamera = useCallback(() => {
    clearWatchdog();
    stopStream();
    setCamOpen(false);
    setCamErr(null);
    setStarting(false);
  }, [clearWatchdog, stopStream]);

  const openCamera = useCallback(async () => {
    // No live camera here → straight to the native picker (this click is a user
    // gesture, so programmatic .click() is allowed).
    if (!hasLiveCamera()) { fileRef.current?.click(); return; }
    setCamErr(null);
    setStarting(true);
    setCamOpen(true);
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (!streamRef.current) {
        setStarting(false);
        setCamErr('The camera did not start. Use your phone camera instead.');
      }
    }, CAMERA_START_TIMEOUT_MS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing }, audio: false,
      });
      clearWatchdog();
      streamRef.current = stream;
      setStarting(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay guard */ });
      }
    } catch (e: unknown) {
      clearWatchdog();
      setStarting(false);
      setCamErr((e as Error)?.message || 'Camera unavailable. Use your phone camera instead.');
    }
  }, [clearWatchdog, facing]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) { setCamErr('Could not capture the frame — try again'); return; }
        const file = new File([blob], `kyc-${facing}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeCamera();
        void uploadFile(file);
      },
      'image/jpeg',
      0.92,
    );
  }, [closeCamera, uploadFile, facing]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadFile(file);
  };

  const iconName = facing === 'user' ? 'camera' : (state === 'done' ? 'check' : 'camera');
  const borderColor =
    state === 'done'  ? 'rgba(34,197,94,0.4)'
  : state === 'error' ? 'rgba(239,68,68,0.4)'
  : 'var(--tec-border)';

  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--tec-text-2)', marginBottom: 8, letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      {/* Tile → opens the in-app live camera (or the native picker as fallback). */}
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
            : <Icon name={state === 'done' ? 'check' : (iconName as 'camera' | 'check')} size={20} color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {state === 'uploading' ? (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>Uploading…</span>
          ) : state === 'done' ? (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>Photo captured</div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#22C55E' }}>Done · tap to retake</div>
            </>
          ) : state === 'error' ? (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: 600 }}>Upload failed</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err} · tap to retry</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{hint}</div>
            </>
          )}
        </div>

        <Icon name={state === 'done' ? 'check' : 'camera'} size={16}
          color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} style={{ flexShrink: 0 }} />
      </button>

      {/* Native fallback input (also the target automated tests fire onto). */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture={facing}
        onChange={onFile}
        aria-label={label}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Always-available alternative: pick an existing file. */}
      {mounted && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', padding: '2px 0',
            color: 'var(--tec-text-3)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
          }}>
          <Icon name="upload" size={13} color="var(--tec-text-3)" /> Or upload a file
        </button>
      )}

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
                  Use phone camera
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                position: 'relative', width: '100%', maxWidth: 400,
                aspectRatio: guide === 'oval' ? '3 / 4' : '4 / 3',
                borderRadius: 20, overflow: 'hidden', background: '#000',
                border: '2px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
                />
                {starting && (
                  <span style={{ position: 'absolute', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)' }}>Starting camera…</span>
                )}
                {/* Capture guide */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: guide === 'oval' ? '62%' : '86%',
                  height: guide === 'oval' ? '74%' : '62%',
                  border: '2px dashed rgba(255,255,255,0.55)',
                  borderRadius: guide === 'oval' ? '50%' : 12,
                  pointerEvents: 'none',
                }} />
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)', margin: 'var(--sp-4) 0' }}>
                {guide === 'oval' ? 'Center your face in the oval, then capture' : 'Fit the document in the frame, then capture'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                <button type="button" onClick={closeCamera}
                  style={{ padding: '12px 22px', borderRadius: 999, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={capture} disabled={starting} aria-label="Capture photo"
                  style={{
                    width: 72, height: 72, borderRadius: '50%', cursor: starting ? 'default' : 'pointer',
                    background: '#fff', border: '4px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 0 0 2px #fff inset', opacity: starting ? 0.5 : 1,
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
