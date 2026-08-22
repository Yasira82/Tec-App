'use client';

import { useState, type MutableRefObject } from 'react';
import { RichText }        from '@/components/ai/RichText';
import { NavChips }        from '@/components/ai/NavChips';
import { useTranslation }  from '@/lib/i18n';
import type { ChatMessage } from '@/lib/ai/chat-types';
import type { Locale }      from '@/lib/i18n';

const aiBubble: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '18px 18px 18px 4px',
  background: '#0d0d1a', border: '1px solid #ffffff08',
  fontSize: 13, color: '#fff', lineHeight: 1.6,
};

export const suggestionChip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
  border: '1px solid var(--tec-border-gold)', background: 'transparent',
  color: 'var(--tec-gold)', fontSize: 12, fontFamily: 'inherit',
};

/** Copy a finished reply. On a phone, re-selecting a long answer by hand is painful. */
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const { t } = useTranslation();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard blocked (permission, insecure context) — stay silent, never crash */
    }
  };
  return (
    <button onClick={copy} aria-label={t.hub.ai.copyReply}
      style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
               color: done ? '#7ee7c0' : '#5a5a6a', fontSize: 11, fontFamily: 'inherit' }}>
      {done ? t.hub.ai.copied : t.hub.ai.copyShort}
    </button>
  );
}

interface Props {
  messages:       ChatMessage[];
  locale:         Locale;
  loading:        boolean;
  failedQuestion: string | null;
  canRestore:     boolean;
  scrollRef:      MutableRefObject<HTMLDivElement | null>;
  onPick:         (question: string) => void;
  onRetry:        (question: string) => void;
  onOpenArchive:  () => void;
}

/**
 * The conversation itself: greeting, bubbles, typing dots, retry chip.
 *
 * Purely presentational — it holds no transport state, so a change to how the
 * assistant *streams* can no longer collide with a change to how it *looks*.
 */
export function ChatTranscript({
  messages, locale, loading, failedQuestion, canRestore, scrollRef,
  onPick, onRetry, onOpenArchive,
}: Props) {
  const { t } = useTranslation();

  return (
    <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text"
      style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {messages.length === 0 && (
        // Rendered, not stored — the greeting must never travel back as history.
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div dir="auto" style={{ ...aiBubble, maxWidth: '90%' }}>
            <RichText text={t.hub.ai.welcome} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {t.hub.ai.suggestions.map(q => (
                <button key={q} onClick={() => onPick(q)} style={suggestionChip}>{q}</button>
              ))}
            </div>
            {canRestore && (
              <button onClick={onOpenArchive}
                style={{ ...suggestionChip, marginTop: 10, borderColor: '#ffffff22', color: '#8a8a9a' }}>
                {t.hub.ai.pastConversations}
              </button>
            )}
          </div>
        </div>
      )}

      {messages.map((m, i) => {
        // An empty streaming bubble would be a bare box — the dots stand in for it
        // until the first delta lands, then the text takes over in place.
        if (m.role === 'ai' && m.streaming && !m.text) {
          return (
            <div key={i} style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tec-gold)', animation: `pulse 1.2s ${d * 0.2}s infinite` }} />
              ))}
            </div>
          );
        }
        return (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div dir="auto" style={{
              maxWidth: '85%', padding: '10px 14px',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.role === 'user' ? 'var(--tec-gold-grad)' : '#0d0d1a',
              border: m.role === 'ai' ? '1px solid #ffffff08' : 'none',
              fontSize: 13, color: m.role === 'user' ? 'var(--tec-on-gold)' : '#fff', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.role === 'ai' ? <RichText text={m.text} /> : m.text}
              {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
              {m.intents && <NavChips intents={m.intents} locale={locale} />}
              {m.role === 'ai' && !m.streaming && m.text.trim() && <CopyButton text={m.text} />}
            </div>
          </div>
        );
      })}

      {failedQuestion && !loading && (
        // An error bubble used to be a dead end — the user had to retype the question.
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={() => onRetry(failedQuestion)} style={suggestionChip}>{t.hub.ai.tryAgain}</button>
        </div>
      )}
    </div>
  );
}
