'use client';

/**
 * The 📎 button and the chips of what is about to be sent — shared by the /ai page and
 * the Hub drawer. The input takes photos (camera or gallery) and PDFs; each file is
 * prepared on the phone (lib-client/ai/attachments.ts) before it becomes a chip.
 */
import { useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { prepareAttachment, MAX_FILES, MAX_TOTAL_B64, totalSize, type PreparedAttachment } from '@/lib-client/ai/attachments';

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
      // Together they must fit one request — six full screenshots can pass the cap.
      else if (totalSize([...next, r]) > MAX_TOTAL_B64) { onError(t.hub.ai.attachTotal); break; }
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

/**
 * What is attached, as a row of square thumbnails (owner, 2026-10-09: "more organised").
 * It used to be one full-width chip per file with its long name — three of them took
 * half the drawer. Tiles scroll sideways; × sits on each corner; a counter shows n/6.
 */
export function AttachChips({
  value, onChange, error, dark,
}: { value: PreparedAttachment[]; onChange: (next: PreparedAttachment[]) => void; error?: string | null; dark?: boolean }) {
  const { t } = useTranslation();
  const c = palette(dark);
  if (!value.length && !error) return null;
  return (
    <div data-testid="ai-attach-chips" style={{ padding: '8px 16px 0' }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingTop: 6 }}>
          {value.map((a, i) => (
            <div key={i} title={a.name} style={{ position: 'relative', flexShrink: 0, width: 56, height: 56 }}>
              {a.thumb
                // eslint-disable-next-line @next/next/no-img-element -- a local data: URL thumbnail, nothing to optimise
                ? <img src={a.thumb} alt={a.name} width={56} height={56}
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: `1px solid ${c.border}`, display: 'block' }} />
                : <div style={{ width: 56, height: 56, borderRadius: 10, background: c.fill, border: `1px solid ${c.border}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: c.text2 }}>
                    📄<span style={{ fontSize: 9, marginTop: 2 }}>PDF</span>
                  </div>}
              <button type="button" aria-label={t.hub.ai.attachRemove}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 20, height: 20, borderRadius: 10,
                         background: '#000c', color: '#fff', border: '1px solid #fff4', fontSize: 11, lineHeight: '18px',
                         padding: 0, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <span style={{ fontSize: 11, color: c.text3, flexShrink: 0, paddingInlineStart: 2 }}>{value.length}/{MAX_FILES}</span>
        </div>
      )}
      {value.length > 0 && (
        <div data-testid="ai-attach-kept" style={{ fontSize: 11, color: c.text3, marginTop: 6 }}>{t.hub.ai.attachKept}</div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--tec-red, #ef4444)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/** The photos a message carried, as a row of thumbnails at the top of its bubble. */
export function SentThumbs({ thumbs }: { thumbs?: string[] }) {
  if (!thumbs?.length) return null;
  return (
    <div data-testid="ai-sent-thumbs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {thumbs.map((src, i) => src
        // eslint-disable-next-line @next/next/no-img-element -- a local data: URL thumbnail
        ? <img key={i} src={src} alt="" width={64} height={64}
            style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
        : <div key={i} style={{ width: 64, height: 64, borderRadius: 10, background: '#0002',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>)}
    </div>
  );
}
