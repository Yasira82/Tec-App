'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createSseReader } from '@/lib/ai-stream';
import { RichText }       from '@/components/ai/RichText';
import { NavChips }       from '@/components/ai/NavChips';
import { parseNavIntents } from '@/lib/ai/nav-intents';
import { loadConversation, saveConversation, archiveConversation, hasArchive, restoreConversation } from '@/lib/ai-session';
import type { NavIntent }  from '@/lib/ai/nav-intents';

/** How many previous turns travel with each question, so follow-ups keep context. */
const HISTORY_TURNS = 8;

/** Longest the first message will wait for personalization before going without it. */
const CONTEXT_WAIT_MS = 1500;

/** Appended when the provider stopped at its output cap — never pretend it finished. */
const TRUNCATED_NOTE = '\n\n… (الإجابة اتقطعت — اسأل "كمّل" عشان الباقي)';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

/**
 * Map a chat-route failure to a clear, honest reason (no silent failures, C-96).
 *
 * The route's `code` wins over the status, because the status cannot tell two very
 * different situations apart: "the AI is not configured" and "every provider is busy
 * right now" are BOTH 503 — so a busy assistant used to tell the user it was switched off.
 */
function errorMessage(status: number, code?: string): string {
  switch (code) {
    case 'SIGN_IN':        return 'سجّل دخولك الأول عشان تستخدم مساعد TEC.';
    case 'RATE_LIMIT':     return 'وصلت للحد الأقصى للرسائل — استنى دقيقة وجرّب تاني.';
    case 'NOT_CONFIGURED': return 'مساعد TEC مش مفعّل حالياً. حاول لاحقاً.';
    case 'BUSY':           return 'المساعد مشغول دلوقتي — جرّب تاني بعد لحظات.';
  }
  switch (status) {
    case 401: return 'سجّل دخولك الأول عشان تستخدم مساعد TEC.';
    case 429: return 'وصلت للحد الأقصى للرسائل — استنى دقيقة وجرّب تاني.';
    case 503: return 'المساعد مشغول دلوقتي — جرّب تاني بعد لحظات.';
    case 502: return 'مساعد TEC مش متاح دلوقتي — حاول تاني بعد شوية.';
    default:  return 'حصل خطأ مؤقت — حاول مرة أخرى.';
  }
}

const WELCOME = `مرحباً! أنا مساعد TEC 🤖 أقدر أساعدك في:
- استكشاف الـ 24 تطبيق في المنظومة
- الإجابة على أسئلتك عن Pi Network
- إرشادك للتطبيق المناسب لاحتياجاتك

إزاي أقدر أساعدك النهاردة؟`;

const SUGGESTIONS = ['ايه هو TEC؟', 'وريني رصيدي', 'أنهي تطبيق يناسبني؟'];

/** Per-tab transcript key. See src/lib/ai-session.ts for why sessionStorage. */
const STORE_KEY = 'tec_ai_drawer';

const aiBubble: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '18px 18px 18px 4px',
  background: '#0d0d1a', border: '1px solid #ffffff08',
  fontSize: 13, color: '#fff', lineHeight: 1.6,
};

const suggestionChip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
  border: '1px solid #FBBF2440', background: 'transparent',
  color: '#FBBF24', fontSize: 12, fontFamily: 'inherit',
};

/** Copy a finished reply. On a phone, re-selecting a long answer by hand is painful. */
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
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
    <button onClick={copy} aria-label="نسخ الرد"
      style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
               color: done ? '#7ee7c0' : '#5a5a6a', fontSize: 11, fontFamily: 'inherit' }}>
      {done ? '✓ اتنسخ' : '⧉ نسخ'}
    </button>
  );
}

/** One rendered bubble. `streaming` marks the reply currently being written. */
interface ChatMessage {
  role:       'user' | 'ai';
  text:       string;
  streaming?: boolean;
  /** Destinations the model recommended, once the reply is complete. */
  intents?:   NavIntent[];
}

export function AIDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input,    setInput]    = useState('');
  // Lazy initialiser, so the restore runs once on mount rather than on every render.
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window === 'undefined' ? [] : loadConversation<ChatMessage>(STORE_KEY));
  const [loading,  setLoading]  = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef  = useRef<HTMLTextAreaElement | null>(null);

  // Lets "stop" cut the stream mid-answer, and guarantees a new question cancels a reply
  // still arriving from the previous one (otherwise two streams write to the same bubble).
  const abortRef = useRef<AbortController | null>(null);
  // The question behind the last failure, so "try again" does not make the user retype it.
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  // Whether a previous thread is sitting in the archive, waiting to be brought back.
  const [canRestore, setCanRestore] = useState(false);
  useEffect(() => { if (open) setCanRestore(hasArchive(STORE_KEY)); }, [open]);

  // Persist after every settled change. A streaming reply is skipped inside
  // saveConversation — restoring a half-sentence would look like a broken answer.
  useEffect(() => {
    if (messages.length) saveConversation(STORE_KEY, messages);
  }, [messages]);

  // Focus the field when the drawer opens, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  // The user's OWN context (username, balance, goals, KYC — assembled server-side by the
  // BFF). The /ai page has always sent this; this drawer never did, so the SAME assistant
  // answered generically in the Hub and personally on /ai. Fetched once when the drawer
  // opens, fail-soft: no context just means a less specific answer, never a broken one.
  // Held as the in-flight PROMISE, not the resolved value: a user who opens the drawer and
  // types straight away would otherwise send their first — and often only — question
  // before the context landed, and get the generic answer anyway.
  const ctxRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  useEffect(() => {
    if (!open || ctxRef.current) return;
    ctxRef.current = (async () => {
      try {
        const res = await fetch('/api/bff/ai/context', { credentials: 'include', cache: 'no-store' });
        return res.ok ? await res.json().catch(() => null) : null;
      } catch {
        return null;   // fail-soft — omit personalization, never block the assistant
      }
    })();
  }, [open]);

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

  const send = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    if (!override) setInput('');
    setFailedQuestion(null);

    // A previous stream must not keep writing into the bubble a new question just created.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // The reply bubble is created EMPTY up front and filled as deltas arrive, so the
    // answer visibly types out. It used to be accumulated in a local string and pushed
    // once at the end — which is why a long reply sat behind three dots and then
    // appeared all at once.
    const history = messages;
    setMessages(prev => [...prev, { role: 'user', text }, { role: 'ai', text: '', streaming: true }]);
    setLoading(true);

    const replyAt = (t: string) =>
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'ai' ? { ...m, text: t } : m));
    // Strip the machine-readable nav marker out of the prose and surface it as a chip.
    // Without this the model's `[[go:nx]]` was printed to the user as literal text — the
    // /ai page has always parsed it; this drawer never did.
    const settle = (t: string, withIntents = true) =>
      setMessages(prev => prev.map((m, i) => {
        if (i !== prev.length - 1 || m.role !== 'ai') return m;
        if (!withIntents) return { role: 'ai' as const, text: t };
        const { clean, intents } = parseNavIntents(t);
        return { role: 'ai' as const, text: clean, intents: intents.length ? intents : undefined };
      }));

    try {
      // Wait for the context, but never longer than this — a stalled personalization
      // request must cost a less specific answer, not the answer itself (P6-ish: degrade,
      // don't block). The bubble with its typing dots is already on screen by now.
      const ctx = ctxRef.current
        ? await Promise.race([
            ctxRef.current,
            new Promise<null>(r => setTimeout(() => r(null), CONTEXT_WAIT_MS)),
          ])
        : null;

      // Send the recent turns too — a question like "and the second one?" is
      // unanswerable when the model only ever receives the latest line.
      const priorTurns = history
        .filter(m => m.text.trim())
        .slice(-HISTORY_TURNS)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...priorTurns, { role: 'user', content: text }],
          userContext: {
            // The page's own language, so the reply matches the UI the user is reading.
            locale: typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar',
            ...(ctx ?? {}),
          },
        }),
      });

      // The chat route replies with an SSE stream ONLY on success; every error is a
      // JSON body with a non-2xx status. Surface the real reason instead of a generic
      // "no response" that hides it (C-96 — no silent failures).
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { code?: string } | null;
        settle(errorMessage(res.status, body?.code), false);
        setFailedQuestion(text);   // offer "try again" instead of a dead end
        return;
      }

      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      // Line-buffered: a `data:` frame split across two network chunks is completed
      // rather than dropped. Dropping it is what made answers stop mid-sentence.
      const sse     = createSseReader();
      let reply     = '';
      let truncated = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = sse.push(decoder.decode(value, { stream: true }));
          if (delta.truncated) truncated = true;
          if (delta.text) { reply += delta.text; replyAt(reply); }
        }
        const tail = sse.flush();
        if (tail.truncated) truncated = true;
        if (tail.text) reply += tail.text;
      }

      const final = reply.trim();
      settle(final
        ? final + (truncated ? TRUNCATED_NOTE : '')
        : 'لم أتمكّن من الرد على هذه الرسالة — جرّب تصيغ سؤالك بشكل أوضح.');
    } catch (e) {
      // "Stop" is a user decision, not a failure: keep the partial answer on screen and
      // say it was stopped. Replacing it with an error would throw away a useful reply.
      if ((e as Error)?.name === 'AbortError') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'ai'
            ? { role: 'ai', text: m.text.trim() ? `${m.text}\n\n… (اتوقف)` : 'اتوقف قبل ما يبدأ.' }
            : m));
      } else {
        settle('خطأ في الاتصال — حاول مرة أخرى.', false);
        setFailedQuestion(text);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
    // `messages` is a real dependency — the request carries the prior turns, so reading
    // a stale copy would silently send an empty history and break follow-up questions.
  }, [input, loading, messages]);

  const stop     = useCallback(() => abortRef.current?.abort(), []);
  // "New chat" ARCHIVES rather than deletes — starting a new conversation is not the
  // same intent as destroying the old one, and one mis-tap used to lose it for good.
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    archiveConversation(STORE_KEY);
    setMessages([]); setFailedQuestion(null); setCanRestore(hasArchive(STORE_KEY));
  }, []);

  const restore = useCallback(() => {
    const turns = restoreConversation<ChatMessage>(STORE_KEY);
    if (turns.length) setMessages(turns);
    setCanRestore(false);
  }, []);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      {/* Near-fullscreen. It was capped at 75vh, which on a phone left a long answer
          scrolling inside a third of the screen while two thirds sat behind a dim
          overlay. `top`+`bottom` rather than a height unit: it needs no dvh support and
          keeps the drawer pinned when the mobile URL bar shows or hides. */}
      <div style={{ position: 'fixed', top: '5vh', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#0B1020', borderTop: '1px solid #FBBF2420', borderRadius: '24px 24px 0 0', padding: '0 0 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff20' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>TEC AI</div>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>Powered by tec.pi</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {messages.length > 0 && (
              <button onClick={newChat} aria-label="محادثة جديدة" title="محادثة جديدة"
                style={{ background: 'none', border: '1px solid #ffffff12', borderRadius: 10, color: '#7a7a8a', cursor: 'pointer', fontSize: 11, padding: '5px 10px', fontFamily: 'inherit' }}>
                محادثة جديدة
              </button>
            )}
            <button onClick={onClose} aria-label="إغلاق" style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
        </div>
        <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text"
          style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            // The /ai page greets the user and says what it can do; this drawer showed a
            // single grey line, so the same assistant looked like two different products.
            // Rendered, not stored — it must never travel back as conversation history.
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div dir="auto" style={{ ...aiBubble, maxWidth: '90%' }}>
                <RichText text={WELCOME} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {SUGGESTIONS.map(q => (
                    <button key={q} onClick={() => setInput(q)} style={suggestionChip}>{q}</button>
                  ))}
                </div>
                {canRestore && (
                  <button onClick={restore}
                    style={{ ...suggestionChip, marginTop: 10, borderColor: '#ffffff22', color: '#8a8a9a' }}>
                    ↺ استرجاع المحادثة السابقة
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
                  {[0,1,2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24', animation: `pulse 1.2s ${d * 0.2}s infinite` }} />)}
                </div>
              );
            }
            return (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div dir="auto" style={{
                  maxWidth: '85%', padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#0d0d1a',
                  border: m.role === 'ai' ? '1px solid #ffffff08' : 'none',
                  fontSize: 13, color: m.role === 'user' ? '#0a0800' : '#fff', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.role === 'ai' ? <RichText text={m.text} /> : m.text}
                  {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
                  {m.intents && <NavChips intents={m.intents} dir="rtl" locale="ar" />}
                  {m.role === 'ai' && !m.streaming && m.text.trim() && <CopyButton text={m.text} />}
                </div>
              </div>
            );
          })}
          {failedQuestion && !loading && (
            // An error bubble used to be a dead end — the user had to retype the question.
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button onClick={() => send(failedQuestion)} style={suggestionChip}>↻ جرّب تاني</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            // Enter sends, Shift+Enter makes a new line — the field was a single-line
            // <input>, so a longer question could not be written at all.
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اسأل TEC AI..."
            rows={1}
            aria-label="اسأل TEC AI"
            // dir="auto" — the field had NO direction, so mixing Arabic with a Latin word
            // ("ايه dx") rendered the two runs in the wrong order as the user typed.
            dir="auto"
            style={{ flex: 1, background: '#0B1020', border: '1px solid #ffffff10', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }} />
          {loading ? (
            // Stop is only reachable WHILE streaming, and keeps whatever already arrived.
            <button onClick={stop} aria-label="إيقاف"
              style={{ width: 44, height: 44, borderRadius: 14, background: '#ffffff10', border: '1px solid #ffffff18', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>◼</button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim()} aria-label="إرسال"
              style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#ffffff08', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>↑</button>
          )}
        </div>
      </div>
    </>
  );
}
