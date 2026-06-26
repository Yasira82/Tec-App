'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation }              from '@/lib/i18n';
import { usePiAuth }                   from '@/lib-client/hooks/usePiAuth';
import Link                            from 'next/link';
import styles                          from './ai.module.css';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
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

  // ✅ Welcome message
  useEffect(() => {
    setMessages([{
      id:        'welcome',
      role:      'assistant',
      timestamp: new Date(),
      content: locale === 'ar'
        ? `مرحباً${user?.piUsername ? ` @${user.piUsername}` : ''}! 👋\n\nأنا مساعد TEC الذكي. يمكنني مساعدتك في:\n- استكشاف الـ 24 تطبيق في المنظومة\n- الإجابة على أسئلتك عن Pi Network\n- إرشادك للتطبيق المناسب لاحتياجاتك\n\nكيف يمكنني مساعدتك اليوم؟`
        : `Welcome${user?.piUsername ? ` @${user.piUsername}` : ''}! 👋\n\nI'm the TEC AI Assistant. I can help you:\n- Explore all 24 apps in the ecosystem\n- Answer questions about Pi Network\n- Guide you to the right app for your needs\n\nHow can I help you today?`,
    }]);
  }, [user, locale]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

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
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content })),
          userContext: { username: user?.piUsername, locale },
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const assistantMessage: Message = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const reader  = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]' || !data) continue;
            try {
              const parsed = JSON.parse(data);
              const delta  = parsed?.text ?? parsed?.delta?.text ?? parsed?.content?.[0]?.text ?? '';
              if (delta) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, content: m.content + delta }
                      : m
                  )
                );
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id:        (Date.now() + 2).toString(),
        role:      'assistant',
        timestamp: new Date(),
        content: locale === 'ar'
          ? '❌ حدث خطأ. يرجى المحاولة مرة أخرى.'
          : '❌ Something went wrong. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
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
            <div className={styles.messages}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                >
                  {msg.role === 'assistant' && (
                    <span className={styles.messageAvatar}>🤖</span>
                  )}
                  <div className={styles.messageBubble}>
                    <p className={styles.messageContent}>{msg.content}</p>
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
                placeholder={locale === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                rows={1}
                disabled={isLoading}
              />
              <button
                className={styles.sendBtn}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                aria-label="Send"
              >
                {dir === 'rtl' ? '←' : '→'}
              </button>
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
