'use client';

import { useState }       from 'react';
import { Icon }           from '@/components/ui/Icon';
import { uploadKycImage } from '@/lib-client/kyc/upload-image';

interface Props {
  label:      string;
  required?:  boolean;
  /** Pre-existing value from the KYC record (a storage key) — shown as "uploaded". */
  initialValue?: string | null;
  /** Called with the durable storage key once an image is uploaded (or '' when cleared). */
  onChange:   (key: string) => void;
}

type State = 'idle' | 'uploading' | 'done' | 'error';

// A real document-photo picker: opens the camera or gallery, previews the
// chosen image, and uploads it to secure storage — replacing the old
// "paste a URL" box. Keeps a native <input type="file"> so the platform
// picker (and the camera on mobile) is used.
export function PhotoUpload({ label, required, initialValue, onChange }: Props) {
  const [state,   setState]   = useState<State>(initialValue ? 'done' : 'idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [name,    setName]    = useState<string | null>(initialValue ? 'Uploaded document' : null);
  const [err,     setErr]     = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setState('uploading');
    setName(file.name);
    try { setPreview(URL.createObjectURL(file)); } catch { /* non-image / SSR */ }
    try {
      const { key } = await uploadKycImage(file);
      onChange(key);
      setState('done');
    } catch (e2: unknown) {
      setErr((e2 as Error).message || 'Upload failed');
      setState('error');
      onChange('');
    }
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

      {/* The file <input> is a FULL-SIZE transparent overlay on top of the tile,
          so a tap lands directly on the input element (not on a wrapper that has
          to forward the event). This is the most robust pattern for mobile
          webviews — no programmatic click, no label-propagation dependency.
          No `capture` → the OS offers both camera and gallery. */}
      <label
        style={{
          position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left', cursor: 'pointer',
          background: 'var(--tec-surface-1)', border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
        }}>
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          aria-label={label}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', zIndex: 2,
          }}
        />
        {/* Visual content sits behind the input; it must not swallow the tap. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', pointerEvents: 'none' }}>
          {/* Thumbnail / icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
          }}>
            {preview
              // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not an optimizable asset
              ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name={state === 'done' ? 'check' : 'upload'} size={20} color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {state === 'uploading' ? (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>Uploading…</span>
            ) : state === 'done' ? (
              <>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: '#22C55E' }}>Uploaded · tap to change</div>
              </>
            ) : state === 'error' ? (
              <>
                <div style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: 600 }}>Upload failed</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err} · tap to retry</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>Take a photo or choose a file</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>JPEG, PNG or WEBP · up to 10MB</div>
              </>
            )}
          </div>

          <Icon name={state === 'done' ? 'check' : 'upload'} size={16}
            color={state === 'done' ? '#22C55E' : 'var(--tec-text-3)'} style={{ flexShrink: 0 }} />
        </div>
      </label>
    </div>
  );
}
