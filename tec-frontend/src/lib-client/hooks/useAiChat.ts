'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createSseReader }  from '@/lib/ai-stream';
import { parseNavIntents }  from '@/lib/ai/nav-intents';
import {
  loadConversation, saveConversation, archiveConversation, hasArchive,
  loadSettings, type AiSettings, type StoredTurn,
} from '@/lib/ai-session';
import type { ChatMessage }  from '@/lib/ai/chat-types';
import type { Translations } from '@/lib/i18n';

/** How many previous turns travel with each question, so follow-ups keep context. */
const HISTORY_TURNS = 8;

/** Longest the first message will wait for personalization before going without it. */
const CONTEXT_WAIT_MS = 1500;

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
export function errorMessage(status: number, e: Translations['hub']['aiErrors'], code?: string): string {
  switch (code) {
    case 'SIGN_IN':        return e.signIn;
    case 'RATE_LIMIT':     return e.rateLimit;
    case 'NOT_CONFIGURED': return e.notConfigured;
    case 'BUSY':           return e.busy;
  }
  switch (status) {
    case 401: return e.signIn;
    case 429: return e.rateLimit;
    case 503: return e.busy;
    case 502: return e.unavailable;
    default:  return e.generic;
  }
}

/**
 * Everything the assistant DOES, separated from everything it looks like.
 *
 * The streaming state machine (abort handling, SSE line-buffering, history,
 * personalization race, archive/restore) is the part that carries the bugs; it
 * had been living inside the drawer's render tree, where a styling change and a
 * transport change touched the same file.
 */
export function useAiChat({ storeKey, open, t }: {
  storeKey: string;
  open:     boolean;
  t:        Translations;
}) {
  // Lazy initialiser, so the restore runs once on mount rather than on every render.
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window === 'undefined' ? [] : loadConversation<ChatMessage>(storeKey));
  const [loading,  setLoading]  = useState(false);
  // The question behind the last failure, so "try again" does not make the user retype it.
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  // Whether a previous thread is sitting in the archive, waiting to be brought back.
  const [canRestore, setCanRestore] = useState(false);
  const [settings,   setSettings]   = useState<AiSettings>(() => loadSettings());

  // Lets "stop" cut the stream mid-answer, and guarantees a new question cancels a reply
  // still arriving from the previous one (otherwise two streams write to the same bubble).
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { if (open) setCanRestore(hasArchive(storeKey)); }, [open, storeKey]);

  // Persist after every settled change. A streaming reply is skipped inside
  // saveConversation — restoring a half-sentence would look like a broken answer.
  useEffect(() => {
    if (messages.length) saveConversation(storeKey, messages);
  }, [messages, storeKey]);

  // The user's OWN context (username, balance, goals, KYC — assembled server-side by the
  // BFF). Fetched once when the drawer opens, fail-soft: no context just means a less
  // specific answer, never a broken one. Held as the in-flight PROMISE, not the resolved
  // value: a user who opens the drawer and types straight away would otherwise send their
  // first — and often only — question before the context landed.
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

  const send = useCallback(async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
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

    const replyAt = (body: string) =>
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.role === 'ai' ? { ...m, text: body } : m));
    // Strip the machine-readable nav marker out of the prose and surface it as a chip.
    // Without this the model's `[[go:nx]]` was printed to the user as literal text.
    const settle = (body: string, withIntents = true) =>
      setMessages(prev => prev.map((m, i) => {
        if (i !== prev.length - 1 || m.role !== 'ai') return m;
        if (!withIntents) return { role: 'ai' as const, text: body };
        const { clean, intents } = parseNavIntents(body);
        return { role: 'ai' as const, text: clean, intents: intents.length ? intents : undefined };
      }));

    try {
      // Wait for the context, but never longer than this — a stalled personalization
      // request must cost a less specific answer, not the answer itself (degrade, don't
      // block). The bubble with its typing dots is already on screen by now.
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
          // The context is passed as the OPAQUE TOKEN the BFF signed, not as the
          // fields themselves. This used to spread `...ctx` into the body, which
          // made the browser the carrier of every platform claim about the user
          // — KYC, goals, activity — and therefore able to rewrite them. The
          // chat route now reads claims only from this token and ignores any
          // such field in the body. See lib/ai/context-token.ts.
          contextToken: (ctx as { contextToken?: string } | null)?.contextToken,
          userContext: {
            // Preferences only. The user's explicit choice wins; 'auto' falls back
            // to the page language, so the reply matches the UI they are reading.
            locale: settings.replyLocale !== 'auto'
              ? settings.replyLocale
              : (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar'),
            replyLength: settings.replyLength,
          },
        }),
      });

      // The chat route replies with an SSE stream ONLY on success; every error is a
      // JSON body with a non-2xx status. Surface the real reason instead of a generic
      // "no response" that hides it (C-96 — no silent failures).
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { code?: string } | null;
        settle(errorMessage(res.status, t.hub.aiErrors, body?.code), false);
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
        for (;;) {
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
        ? final + (truncated ? `\n\n${t.hub.ai.truncated}` : '')
        : t.hub.ai.noAnswer);
    } catch (e) {
      // "Stop" is a user decision, not a failure: keep the partial answer on screen and
      // say it was stopped. Replacing it with an error would throw away a useful reply.
      if ((e as Error)?.name === 'AbortError') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'ai'
            ? { role: 'ai', text: m.text.trim() ? `${m.text}\n\n${t.hub.ai.stopped}` : t.hub.ai.stoppedEmpty }
            : m));
      } else {
        settle(t.hub.ai.connectionError, false);
        setFailedQuestion(text);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
    // `messages` is a real dependency — the request carries the prior turns, so reading
    // a stale copy would silently send an empty history and break follow-up questions.
  }, [loading, messages, settings, t]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // "New chat" ARCHIVES rather than deletes — starting a new conversation is not the
  // same intent as destroying the old one, and one mis-tap used to lose it for good.
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    archiveConversation(storeKey);
    setMessages([]); setFailedQuestion(null); setCanRestore(hasArchive(storeKey));
  }, [storeKey]);

  const restoreTurns = useCallback((turns: StoredTurn[]) => {
    if (turns.length) setMessages(turns as ChatMessage[]);
    setCanRestore(hasArchive(storeKey));
  }, [storeKey]);

  const clearAll = useCallback(() => { setMessages([]); setCanRestore(false); }, []);

  return {
    messages, loading, failedQuestion, canRestore,
    send, stop, newChat, restoreTurns, clearAll, setSettings,
  };
}
