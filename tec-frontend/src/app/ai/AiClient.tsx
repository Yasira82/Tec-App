'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation }              from '@/lib/i18n';
import { usePiAuth }                   from '@/lib-client/hooks/usePiAuth';
import { parseNavIntents }             from '@/lib/ai/nav-intents';
import type { NavIntent, NavFlow }     from '@/lib/ai/nav-intents';
import { createSseReader }             from '@/lib/ai-stream';
import { loadConversation, saveConversation, clearConversation } from '@/lib/ai-session';
import { RichText }                    from '@/components/ai/RichText';
import { t }                           from '@/domains/_types';
import type { Locale }                 from '@/domains/_types';
import Link                            from 'next/link';
import styles                          from './ai.module.css';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

// A single navigation-intent chip — an internal Link for Hub paths, an external
// anchor for another app's domain. Shared by single intents and flow steps.
function IntentChip({ intent, locale, dir }: { intent: NavIntent; locale: Locale; dir: string }) {
  const label    = intent.label ?? t(intent.name, locale);
  const external = /^https?:\/\//.test(intent.href);
  const arrow    = dir === 'rtl' ? '←' : '→';
  const inner    = <>{label} <span aria-hidden>{arrow}</span></>;
  return external
    ? <a href={intent.href} target="_blank" rel="noopener noreferrer" className={styles.intentChip}>{inner}</a>
    : <Link href={intent.href} className={styles.intentChip}>{inner}</Link>;
}

interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
  intents?:  NavIntent[];
  flows?:    NavFlow[];
}

const SUGGESTED_QUESTIONS = [
  { en: 'How do I invest with Pi?',  ar: 'كيف أستثمر بـ Pi؟'     },
  { en: 'Show my TEC balance',       ar: 'وريني رصيدي'            },
  { en: 'What is Nexus.pi?',         ar: 'ما هو Nexus.pi؟'        },
  { en: 'Best app for real estate?', ar: 'أفضل app للعقارات؟'     },
];

const QUICK_ACTIONS = [
  { emoji: '⊞',  en: 'TEC Hub',          ar: 'الرئيسية',            href: '/hub'       },
  { emoji: '💰', en: 'Pay with Pi',       ar: 'ادفع بـ Pi',          href: '/hub'       },
  { emoji: '📊', en: 'My Dashboard',      ar: 'لوحة التحكم',         href: '/dashboard' },
  { emoji: '💎', en: 'Digital Assets',    ar: 'الأصول الرقمية',      href: '/assets'    },
];

const POPULAR_TOPICS = [
  { en: 'Getting Started Guide',  ar: 'دليل البداية'         },
  { en: 'Payment Methods',        ar: 'طرق الدفع'            },
  { en: 'Domain Categories',      ar: 'تصنيفات التطبيقات'    },
  { en: 'Pi Network Integration', ar: 'تكامل Pi Network'     },
  { en: 'Security & Privacy',     ar: 'الأمان والخصوصية'     },
];

/** Per-tab transcript key. See src/lib/ai-session.ts for why sessionStorage. */
const STORE_KEY = 'tec_ai_page';

const SUPPORT_LINKS = [
  { emoji: '📱', label: 'WhatsApp', href: 'https://wa.me/201115141346',      color: '#25D366' },
  { emoji: '✈️', label: 'Telegram', href: 'https://t.me/Yasira17',           color: '#229ED9' },
  { emoji: '📧', label: 'Email',    href: 'mailto:yasserrr.fox17@gmail.com', color: '#FBBF24' },
  { emoji: '📞', label: 'Call',     href: 'tel:+201115141346',               color: '#7ee7c0' },
];

export default function AiClient() {
  const { dir, locale }  = useTranslation();
  const { user }         = usePiAuth();
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [rating,       setRating]       = useState(0);
  const [ratingDone,   setRatingDone]   = useState(false);
  const [activePanel,  setActivePanel]  = useState<'services' | 'support' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  // Lets "stop" cut the stream, and stops a previous reply writing into a new bubble.
  const abortRef       = useRef<AbortController | null>(null);
  // Declared here, ABOVE the restore effect that sets it: a `const` is in the temporal
  // dead zone until its declaration runs, so reading it from an earlier effect throws.
  const seeded         = useRef(false);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);

  // Restore the transcript for this tab. Without it, navigating to an app the assistant
  // recommended and coming back lost the whole conversation.
  useEffect(() => {
    const saved = loadConversation<{ role: string; text: string }>(STORE_KEY);
    if (!saved.length) return;
    seeded.current = true;   // a restored thread must not be overwritten by the greeting
    setMessages(saved.map((m, i) => ({
      id:        `restored-${i}`,
      role:      m.role === 'user' ? 'user' : 'assistant',
      content:   m.text,
      timestamp: new Date(),
    })));
  }, []);

  useEffect(() => {
    const settled = messages.filter(m => m.id !== 'welcome' && m.content.trim());
    if (settled.length) saveConversation(STORE_KEY, settled.map(m => ({ role: m.role, text: m.content })));
  }, [messages]);

  // Personalization context (C-104 · C-121): the user's OWN goals/activity/KYC,
  // assembled server-side by the BFF. Fetched once per session; fail-soft — if it
  // never arrives the assistant still works on base context.
  const [aiCtx, setAiCtx] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!user?.piUsername) { setAiCtx(null); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/bff/ai/context', { credentials: 'include', cache: 'no-store' });
        if (alive && res.ok) setAiCtx(await res.json().catch(() => null));
      } catch { /* fail-soft — omit personalization */ }
    })();
    return () => { alive = false; };
  }, [user?.piUsername]);

  // (declared above the restore effect on purpose — see the restore effect)
  // The welcome is seeded ONCE. It used to run on [user, locale] and call setMessages
  // with a fresh single-item array — so switching language, or the session resolving a
  // beat late (the C-123 server path in Pi Browser flips `user` from null to an object),
  // WIPED the entire conversation with no warning. The greeting is not worth a
  // conversation. Re-seeding only happens while the thread is still empty.
  // One builder, used by the initial seed AND by "new chat" — otherwise starting over
  // dropped the user onto a blank page with no greeting.
  const welcomeMessage = useCallback((): Message => ({
    id:        'welcome',
    role:      'assistant',
    timestamp: new Date(),
    content: locale === 'ar'
      ? `مرحباً${user?.piUsername ? ` @${user.piUsername}` : ''}! 👋\n\nأنا مساعد TEC الذكي. يمكنني مساعدتك في:\n- استكشاف الـ 24 تطبيق في المنظومة\n- الإجابة على أسئلتك عن Pi Network\n- إرشادك للتطبيق المناسب لاحتياجاتك\n\nكيف يمكنني مساعدتك اليوم؟`
      : `Welcome${user?.piUsername ? ` @${user.piUsername}` : ''}! 👋\n\nI'm the TEC AI Assistant. I can help you:\n- Explore all 24 apps in the ecosystem\n- Answer questions about Pi Network\n- Guide you to the right app for your needs\n\nHow can I help you today?`,
  }), [locale, user?.piUsername]);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setMessages([welcomeMessage()]);
  }, [welcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Deep-link hand-off: another app (e.g. Nexus "Ask TEC AI") can open the assistant
  // with the user's goal prefilled via ?q=. We prefill the input (not auto-send) so the
  // user reviews it and keeps control — and so the personalization context is loaded first.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) setInput(q.trim());
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    setFailedQuestion(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: Message = {
      id:        Date.now().toString(),
      role:      'user',
      content:   content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method:  'POST',
        credentials: 'include',
        signal:  controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content })),
          userContext: { username: user?.piUsername, locale, ...(aiCtx ?? {}) },
        }),
      });

      if (!response.ok) {
        // Surface the ACTUAL reason so failures are diagnosable, not a blanket
        // "something went wrong" (401 sign-in · 429 rate · 503 not configured · else).
        let serverMsg  = '';
        let serverCode = '';
        try {
          const body = (await response.json()) as { error?: string; code?: string };
          serverMsg  = body?.error ?? '';
          serverCode = body?.code  ?? '';
        } catch { /* no JSON body */ }
        // Trust the server's CODE over the status. Status could not tell these apart:
        // "AI not configured" and "every provider is busy" are both 503, so a busy
        // assistant used to tell the user it was switched off.
        const code = serverCode ||
          (response.status === 401 ? 'SIGN_IN'
          : response.status === 429 ? 'RATE_LIMIT'
          : response.status === 503 ? 'NOT_CONFIGURED'
          : 'FAILED');
        const e = new Error(code) as Error & { serverMsg?: string };
        e.serverMsg = serverMsg;
        setFailedQuestion(content.trim());
        throw e;
      }

      const assistantMessage: Message = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const reader  = response.body?.getReader();
      const decoder = new TextDecoder();
      // Line-buffered SSE. This loop used to split EACH network chunk on its own, so a
      // `data:` frame that arrived in two pieces — routine on mobile — failed JSON.parse
      // and was dropped by a bare catch, and the answer stopped mid-sentence with no
      // error. Same reader as the Hub drawer now (src/lib/ai-stream.ts).
      const sse = createSseReader();
      let full      = '';
      let truncated = false;

      const absorb = (delta: { text: string; truncated: boolean }) => {
        if (delta.truncated) truncated = true;
        if (!delta.text) return;
        full += delta.text;
        setMessages(prev =>
          prev.map(m => (m.id === assistantMessage.id ? { ...m, content: full } : m)),
        );
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          absorb(sse.push(decoder.decode(value, { stream: true })));
        }
        absorb(sse.flush());
      }

      // The provider hit its output cap. Say so — an answer that just stops reads as a
      // crash (C-96: a silent cut is an invisible failure).
      if (truncated) {
        full += locale === 'ar'
          ? '\n\n… (الإجابة اتقطعت عند الحد الأقصى — اسأل "كمّل" عشان الباقي)'
          : '\n\n… (answer cut off at the length limit — ask "continue" for the rest)';
      }

      // Resolve navigation intents: strip the machine-read marker from the prose
      // and surface the recommended app as an action chip (a pointer, never an action).
      const { clean, intents, flows } = parseNavIntents(full);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: clean,
                intents: intents.length ? intents : undefined,
                flows:   flows.length   ? flows   : undefined,
              }
            : m,
        )
      );
    } catch (err) {
      // "Stop" is a user decision, not a failure — keep the partial answer on screen.
      if ((err as Error)?.name === 'AbortError') {
        setIsLoading(false);
        abortRef.current = null;
        return;
      }
      const code = err instanceof Error ? err.message : 'FAILED';
      const serverMsg = (err as { serverMsg?: string })?.serverMsg;
      const ar = locale === 'ar';
      let content: string;
      if (code === 'SIGN_IN') {
        content = ar ? '🔒 سجّل دخولك بحساب Pi عشان تستخدم مساعد TEC.'
                     : '🔒 Please sign in with Pi to use the TEC Assistant.';
      } else if (code === 'RATE_LIMIT') {
        content = ar ? '⏳ طلبات كتير — استنى دقيقة وحاول تاني.'
                     : '⏳ Too many requests — wait a minute and try again.';
      } else if (code === 'NOT_CONFIGURED') {
        content = ar ? '🔧 مساعد TEC لسه مش مفعّل. جرّب بعدين.'
                     : '🔧 The TEC Assistant isn’t switched on yet. Try again later.';
      } else if (code === 'BUSY') {
        content = ar ? '⏳ المساعد مشغول دلوقتي — جرّب تاني بعد لحظات.'
                     : '⏳ The assistant is busy right now — try again in a moment.';
      } else {
        content = ar ? '❌ المساعد مش متاح دلوقتي — جرّب تاني بعد شوية.'
                     : '❌ The assistant is temporarily unavailable — try again shortly.';
        // Deliberately NOT appending the provider's raw error: a wall of vendor JSON in a
        // chat bubble tells the user nothing they can act on. The full reason goes to the
        // server log, where it is actually diagnosable (C-96 — logged, not displayed).
      }
      setMessages(prev => [...prev, {
        id:        (Date.now() + 2).toString(),
        role:      'assistant',
        timestamp: new Date(),
        content,
      }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <main className={styles.main} dir={dir}>

      <div className={styles.bg} aria-hidden>
        <div className={styles.bgOrb} />
        <div className={styles.bgGrid} />
      </div>

      {/* Header */}
      <header className={styles.header}>
        <Link href="/hub" className={styles.backLink}>← Hub</Link>
        <div className={styles.headerCenter}>
          <span className={styles.headerIcon}>🤖</span>
          <div>
            <p className={styles.headerTitle}>TEC AI</p>
            <p className={styles.headerSub}>
              {locale === 'ar' ? 'مساعدك الذكي في منظومة TEC' : 'Your AI guide to TEC ecosystem'}
            </p>
          </div>
        </div>
        <div className={styles.headerStatus}>
          {messages.filter(m => m.id !== 'welcome').length > 0 && (
            <button
              onClick={() => {
                abortRef.current?.abort();
                clearConversation(STORE_KEY);
                setFailedQuestion(null);
                setMessages([welcomeMessage()]);
              }}
              aria-label={locale === 'ar' ? 'محادثة جديدة' : 'New chat'}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                       color: 'rgba(232,224,208,0.55)', cursor: 'pointer', fontSize: 11,
                       padding: '5px 10px', fontFamily: 'inherit', marginInlineEnd: 8 }}>
              {locale === 'ar' ? 'محادثة جديدة' : 'New chat'}
            </button>
          )}
          <span className={styles.statusDot} />
          <span className={styles.statusText}>{locale === 'ar' ? 'نشط' : 'Online'}</span>
        </div>
      </header>

      {/* Layout */}
      <div className={styles.layout}>

        {/* ── Left: Services ── */}
        <aside className={`${styles.panel} ${activePanel === 'services' ? styles.panelOpen : ''}`}>
          <button
            className={styles.panelTab}
            onClick={() => setActivePanel(activePanel === 'services' ? null : 'services')}
          >
            ⚡ {locale === 'ar' ? 'الخدمات' : 'Services'}
          </button>
          <div className={styles.panelContent}>
            <div className={styles.panelSection}>
              <p className={styles.panelSectionTitle}>
                {locale === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
              </p>
              {QUICK_ACTIONS.map((action, i) => (
                <Link key={i} href={action.href} className={styles.actionItem}>
                  <span className={styles.actionEmoji}>{action.emoji}</span>
                  <span className={styles.actionLabel}>
                    {locale === 'ar' ? action.ar : action.en}
                  </span>
                  <span className={styles.actionArrow}>{dir === 'rtl' ? '←' : '→'}</span>
                </Link>
              ))}
            </div>
            <div className={styles.panelSection}>
              <p className={styles.panelSectionTitle}>
                {locale === 'ar' ? 'مواضيع شائعة' : 'Popular Topics'}
              </p>
              {POPULAR_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  className={styles.topicItem}
                  onClick={() => sendMessage(locale === 'ar' ? topic.ar : topic.en)}
                >
                  <span>{dir === 'rtl' ? '←' : '→'}</span>
                  <span>{locale === 'ar' ? topic.ar : topic.en}</span>
                </button>
              ))}
            </div>
            <div className={styles.statusBox}>
              <div className={styles.statusRow}>
                <span className={styles.statusDotGreen} />
                <span className={styles.statusLabel}>
                  {locale === 'ar' ? 'جميع الأنظمة تعمل' : 'All systems operational'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Center: Chat ── */}
        <div className={styles.chatArea}>
          <div className={styles.messagesWrap}>
            <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                >
                  {msg.role === 'assistant' && (
                    <span className={styles.messageAvatar}>🤖</span>
                  )}
                  {/* dir="auto" — the page direction follows the UI LOCALE, but a reply
                      follows the QUESTION. An Arabic answer inside an English-locale page
                      rendered with its punctuation at the wrong end until this was set. */}
                  <div className={styles.messageBubble} dir="auto">
                    {/* Rendered, not printed: the model emits **bold** and bullets, and
                        a raw <p> put the asterisks on screen. Same renderer as the Hub. */}
                    <RichText text={msg.content} className={styles.messageContent} />
                    {msg.intents && msg.intents.length > 0 && (
                      <div className={styles.intentRow}>
                        {msg.intents.map(intent => (
                          <IntentChip
                            key={intent.action ? `${intent.slug}:${intent.action}` : intent.slug}
                            intent={intent} locale={locale} dir={dir}
                          />
                        ))}
                      </div>
                    )}
                    {msg.flows && msg.flows.map((flow, fi) => (
                      <div key={fi} className={styles.flowCard}>
                        <div className={styles.flowTitle}>
                          {locale === 'ar' ? 'خطوات مقترحة' : 'Suggested steps'}
                        </div>
                        {flow.steps.map((step, si) => (
                          <div key={si} className={styles.flowStep}>
                            <span className={styles.flowNum}>{si + 1}</span>
                            <IntentChip intent={step} locale={locale} dir={dir} />
                          </div>
                        ))}
                      </div>
                    ))}
                    <span className={styles.messageTime}>
                      {msg.timestamp.toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className={`${styles.message} ${styles.messageAssistant}`}>
                  <span className={styles.messageAvatar}>🤖</span>
                  <div className={styles.messageBubble}>
                    <div className={styles.typing}><span /><span /><span /></div>
                  </div>
                </div>
              )}
              {failedQuestion && !isLoading && (
                // An error message used to be a dead end — the question had to be retyped.
                <button className={styles.suggestionBtn} onClick={() => sendMessage(failedQuestion)}>
                  ↻ {locale === 'ar' ? 'جرّب تاني' : 'Try again'}
                </button>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {messages.length <= 1 && (
            <div className={styles.suggestions}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className={styles.suggestionBtn}
                  onClick={() => sendMessage(locale === 'ar' ? q.ar : q.en)}
                >
                  {locale === 'ar' ? q.ar : q.en}
                </button>
              ))}
            </div>
          )}

          <div className={styles.inputWrap}>
            <div className={styles.inputBox}>
              <textarea
                ref={inputRef}
                className={styles.input}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                dir="auto"
                placeholder={locale === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                rows={1}
                disabled={isLoading}
              />
              {isLoading ? (
                <button
                  className={styles.sendBtn}
                  onClick={() => abortRef.current?.abort()}
                  aria-label={locale === 'ar' ? 'إيقاف' : 'Stop'}
                >◼</button>
              ) : (
                <button
                  className={styles.sendBtn}
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  aria-label="Send"
                >
                  {dir === 'rtl' ? '←' : '→'}
                </button>
              )}
            </div>
            <p className={styles.inputHint}>
              {locale === 'ar'
                ? 'Enter للإرسال · Shift+Enter لسطر جديد'
                : 'Enter to send · Shift+Enter for new line'}
            </p>
          </div>
        </div>

        {/* ── Right: Support ── */}
        <aside className={`${styles.panel} ${activePanel === 'support' ? styles.panelOpen : ''}`}>
          <button
            className={styles.panelTab}
            onClick={() => setActivePanel(activePanel === 'support' ? null : 'support')}
          >
            💬 {locale === 'ar' ? 'الدعم' : 'Support'}
          </button>
          <div className={styles.panelContent}>
            <div className={styles.panelSection}>
              <p className={styles.panelSectionTitle}>
                {locale === 'ar' ? 'قيّم تجربتك' : 'Rate Your Experience'}
              </p>
              {ratingDone ? (
                <p className={styles.ratingDone}>
                  ✅ {locale === 'ar' ? 'شكراً على تقييمك!' : 'Thanks for your rating!'}
                </p>
              ) : (
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      className={`${styles.star} ${rating >= star ? styles.starActive : ''}`}
                      onClick={() => { setRating(star); setRatingDone(true); }}
                    >★</button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.panelSection}>
              <p className={styles.panelSectionTitle}>
                {locale === 'ar' ? 'تواصل معنا' : 'Contact Us'}
              </p>
              {SUPPORT_LINKS.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.supportLink}
                  style={{ '--support-color': link.color } as React.CSSProperties}
                >
                  <span className={styles.supportEmoji}>{link.emoji}</span>
                  <span className={styles.supportLabel}>{link.label}</span>
                  <span className={styles.supportArrow}>↗</span>
                </a>
              ))}
            </div>
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                {locale === 'ar'
                  ? '💡 فريق الدعم متاح 24/7 للمساعدة في أي استفسار'
                  : '💡 Support team available 24/7 for any inquiries'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
                    }
