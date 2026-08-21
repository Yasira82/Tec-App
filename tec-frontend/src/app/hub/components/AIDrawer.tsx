'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createSseReader } from '@/lib/ai-stream';
import { RichText }       from '@/components/ai/RichText';

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

/** One rendered bubble. `streaming` marks the reply currently being written. */
interface ChatMessage {
  role:       'user' | 'ai';
  text:       string;
  streaming?: boolean;
}

export function AIDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  // Follow the answer as it is written, instead of leaving it below the fold.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
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
    const settle = (t: string) =>
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'ai' ? { role: 'ai', text: t } : m));

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
        settle(errorMessage(res.status, body?.code));
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
    } catch {
      settle('خطأ في الاتصال — حاول مرة أخرى.');
    } finally { setLoading(false); }
    // `messages` is a real dependency — the request carries the prior turns, so reading
    // a stale copy would silently send an empty history and break follow-up questions.
  }, [input, loading, messages]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#0B1020', borderTop: '1px solid #FBBF2420', borderRadius: '24px 24px 0 0', padding: '0 0 32px', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#4a4a5a', fontSize: 13 }}>مرحباً! أنا مساعدك الذكي على TEC 🤖</div>
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
                <div style={{
                  maxWidth: '80%', padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#0d0d1a',
                  border: m.role === 'ai' ? '1px solid #ffffff08' : 'none',
                  fontSize: 13, color: m.role === 'user' ? '#0a0800' : '#fff', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.role === 'ai' ? <RichText text={m.text} /> : m.text}
                  {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="اسأل TEC AI..."
            style={{ flex: 1, background: '#0B1020', border: '1px solid #ffffff10', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 13, outline: 'none' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#ffffff08', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>↑</button>
        </div>
      </div>
    </>
  );
}
