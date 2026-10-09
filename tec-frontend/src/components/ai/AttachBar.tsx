'use client';

/**
 * The 📎 button and the chips of what is about to be sent — shared by the /ai page and
 * the Hub drawer. The input takes photos (camera or gallery) and PDFs; each file is
 * prepared on the phone (lib-client/ai/attachments.ts) before it becomes a chip.
 */
import { useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { prepareAttachment, MAX_FILES, type PreparedAttachment } from '@/lib-client/ai/attachments';

/**
 * The /ai page is always dark and does not follow the Hub theme tokens; the drawer does.
 * `dark` gives the page fixed colours so the chips stay readable there.
 */
const palette = (dark?: boolean) => dark
  ? { fill: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.16)', text1: '#ffffff', text2: '#e4e4ec', text3: '#a0a0b0' }
  : { fill: 'var(--tec-fill-soft)', border: 'var(--tec-border)', text1: 'var(--tec-text-1)', text2: 'var(--tec-text-2)', text3: 'var(--tec-text-3)' };

export function AttachButton({
  value, onChange, onError, disabled, dark,
}: {
  value:    PreparedAttachment[];
  onChange: (next: PreparedAttachment[]) => void;
  onError:  (message: string | null) => void;
  disabled?: boolean;
  dark?:    boolean;
}) {
  const { t } = useTranslation();
  const c = palette(dark);
  const ref = useRef<HTMLInputElement | null>(null);

  const pick = async (files: FileList | null) => {
    onError(null);
    if (!files?.length) return;
    const next = [...value];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_FILES) { onError(t.hub.ai.attachTooMany); break; }
      const r = await prepareAttachment(f);
      if (r === 'type') onError(t.hub.ai.attachType);
      else if (r === 'too_big') onError(t.hub.ai.attachTooBig);
      else if (r === 'unreadable') onError(t.hub.ai.attachUnreadable);
      else next.push(r);
    }
    onChange(next);
    if (ref.current) ref.current.value = '';
  };

  return (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" multiple hidden
        data-testid="ai-attach-input" onChange={e => void pick(e.target.files)} />
      <button type="button" onClick={() => ref.current?.click()} disabled={disabled || value.length >= MAX_FILES}
        aria-label={t.hub.ai.attach} title={t.hub.ai.attach}
        style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: c.fill, border: `1px solid ${c.border}`, cursor: 'pointer', fontSize: 18, color: c.text1 }}>
        📎
      </button>
    </>
  );
}

export function AttachChips({
  value, onChange, error, dark,
}: { value: PreparedAttachment[]; onChange: (next: PreparedAttachment[]) => void; error?: string | null; dark?: boolean }) {
  const { t } = useTranslation();
  const c = palette(dark);
  if (!value.length && !error) return null;
  return (
    <div data-testid="ai-attach-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px 0' }}>
      {value.map((a, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 10, background: c.fill, border: `1px solid ${c.border}`, fontSize: 12, color: c.text2, maxWidth: '100%' }}>
          {a.thumb
            // eslint-disable-next-line @next/next/no-img-element -- a local data: URL thumbnail, nothing to optimise
            ? <img src={a.thumb} alt="" width={24} height={24} style={{ borderRadius: 4, objectFit: 'cover' }} />
            : <span aria-hidden>📄</span>}
          <span dir="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{a.name}</span>
          <button type="button" aria-label={t.hub.ai.attachRemove}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            style={{ background: 'none', border: 'none', color: c.text3, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        </span>
      ))}
      {value.length > 0 && (
        <span data-testid="ai-attach-kept" style={{ fontSize: 11, color: c.text3, width: '100%' }}>{t.hub.ai.attachKept}</span>
      )}
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--tec-red, #ef4444)', width: '100%' }}>{error}</span>}
    </div>
  );
}
