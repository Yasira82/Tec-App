'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AIMenu }              from '@/components/ai/AIMenu';
import { ChatTranscript }      from '@/components/ai/ChatTranscript';
import { useAiChat }           from '@/lib-client/hooks/useAiChat';
import { useTranslation }      from '@/lib/i18n';
import { Icon }                from '@/components/ui/Icon';

/** Per-tab transcript key. See src/lib/ai-session.ts for why sessionStorage. */
const STORE_KEY = 'tec_ai_drawer';

export function AIDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, dir } = useTranslation();
  const [input,    setInput]    = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef  = useRef<HTMLTextAreaElement | null>(null);

  const {
    messages, loading, failedQuestion, canRestore,
    send, stop, newChat, restoreTurns, clearAll, setSettings,
  } = useAiChat({ storeKey: STORE_KEY, open, t });

  const submit = useCallback((override?: string) => {
    const question = override ?? input;
    if (!override) setInput('');
    void send(question);
  }, [input, send]);

  // Focus the field when the drawer opens, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  // Grow the field with the text, up to the max-height set on it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Follow the answer as it is written, instead of leaving it below the fold.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!open) return null;

  return (
    <>
      {/* A real <button>, not a clickable <div>: the backdrop is the largest
          dismiss target on the screen, and as a div it was invisible to a screen
          reader and unreachable from a keyboard. Escape closes it too (above). */}
      <button type="button" onClick={onClose} aria-label={t.hub.ai.closeBackdrop}
        style={{ position: 'fixed', inset: 0, zIndex: 300, border: 'none', padding: 0, cursor: 'pointer',
                 background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Near-fullscreen. It was capped at 75vh, which on a phone left a long answer
          scrolling inside a third of the screen while two thirds sat behind a dim
          overlay. `top`+`bottom` rather than a height unit: it needs no dvh support and
          keeps the drawer pinned when the mobile URL bar shows or hides.
          `dir` — the shell used to stay LTR on an Arabic page, so the header and the
          starter chips read right-to-left inside a left-to-right frame. */}
      <div role="dialog" aria-modal="true" aria-label={t.hub.ai.dialog} dir={dir}
        style={{ position: 'fixed', top: '5vh', bottom: 0, left: 0, right: 0, zIndex: 301, background: 'var(--tec-surface-1)', borderTop: '1px solid var(--tec-border-gold)', borderRadius: '24px 24px 0 0', padding: '0 0 24px', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff20' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--tec-gold-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bot" size={18} color="var(--tec-bg)" strokeWidth={2} /></div>
            <div>
              <div dir="ltr" style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'start' }}>TEC AI</div>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>{t.hub.ai.poweredBy}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setMenuOpen(v => !v)} aria-label={t.hub.ai.menu} title={t.hub.ai.menu}
              aria-expanded={menuOpen}
              style={{ background: 'none', border: '1px solid #ffffff12', borderRadius: 10, color: menuOpen ? 'var(--tec-gold)' : '#7a7a8a', cursor: 'pointer', fontSize: 14, padding: '5px 10px', fontFamily: 'inherit' }}>
              ☰
            </button>
            {messages.length > 0 && (
              <button onClick={() => { newChat(); setMenuOpen(false); }} aria-label={t.hub.ai.newChat} title={t.hub.ai.newChat}
                style={{ background: 'none', border: '1px solid #ffffff12', borderRadius: 10, color: '#7a7a8a', cursor: 'pointer', fontSize: 11, padding: '5px 10px', fontFamily: 'inherit' }}>
                {t.hub.ai.newChat}
              </button>
            )}
            <button onClick={onClose} aria-label={t.hub.ai.close}
              style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
        </div>

        {menuOpen ? (
          <div style={{ flex: 1, minHeight: 0, padding: '0 16px', display: 'flex' }}>
            <AIMenu
              storeKey={STORE_KEY} locale={locale}
              onRestore={restoreTurns}
              onAsk={q => { setInput(q); inputRef.current?.focus(); }}
              onClearAll={clearAll}
              onSettingsChange={setSettings}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        ) : (
          <ChatTranscript
            messages={messages}
            locale={locale}
            loading={loading}
            failedQuestion={failedQuestion}
            canRestore={canRestore}
            scrollRef={scrollRef}
            onPick={setInput}
            onRetry={q => submit(q)}
            onOpenArchive={() => setMenuOpen(true)}
          />
        )}

        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            // Enter sends, Shift+Enter makes a new line — the field was a single-line
            // <input>, so a longer question could not be written at all.
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={t.hub.ai.placeholder}
            rows={1}
            aria-label={t.hub.ai.ask}
            // dir="auto" — the field had NO direction, so mixing Arabic with a Latin word
            // ("ايه dx") rendered the two runs in the wrong order as the user typed.
            dir="auto"
            style={{ flex: 1, background: 'var(--tec-surface-1)', border: '1px solid #ffffff10', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }} />
          {loading ? (
            // Stop is only reachable WHILE streaming, and keeps whatever already arrived.
            <button onClick={stop} aria-label={t.hub.ai.stop}
              style={{ width: 44, height: 44, borderRadius: 14, background: '#ffffff10', border: '1px solid #ffffff18', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>◼</button>
          ) : (
            <button onClick={() => submit()} disabled={!input.trim()} aria-label={t.hub.ai.send}
              style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? 'var(--tec-gold-grad)' : '#ffffff08', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>↑</button>
          )}
        </div>
      </div>
    </>
  );
}
