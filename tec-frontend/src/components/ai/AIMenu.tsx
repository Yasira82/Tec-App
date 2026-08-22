'use client';

import { useState } from 'react';
import {
  listArchives, restoreArchive, deleteArchive, clearAll,
  loadSettings, saveSettings,
  type ArchivedChat, type AiSettings, type StoredTurn,
} from '@/lib/ai-session';

/**
 * The assistant's own menu — archived chats, settings, starter questions, support.
 *
 * ONE component for BOTH surfaces (the Hub drawer and the /ai page). The two have drifted
 * three times in this feature already; a menu that exists on one and not the other would
 * be the fourth.
 *
 * It deliberately contains NOTHING about the Hub. The /ai panel it replaces held "TEC Hub
 * / Pay with Pi / My Dashboard / Digital Assets" — app links inside the assistant, which
 * made the assistant a second front door to the platform. The Hub is the single entry
 * (sign in with Pi); the assistant recommends and explains, and points at an app through
 * a nav chip in a reply — never through a private menu of its own.
 */

const L = {
  ar: {
    menu: 'القائمة', chats: 'المحادثات', settings: 'الإعدادات',
    ask: 'أسئلة جاهزة', support: 'الدعم',
    empty: 'مفيش محادثات محفوظة لسه.',
    restore: 'استرجاع', remove: 'حذف',
    replyLang: 'لغة الرد', auto: 'تلقائي', arabic: 'عربي', english: 'إنجليزي',
    replyLen: 'طول الرد', short: 'مختصر', detailed: 'مفصّل',
    clearAll: 'مسح كل المحادثات', confirm: 'متأكد؟ مش هينفع ترجعها',
    now: 'دلوقتي', minsAgo: 'من {n} د', hoursAgo: 'من {n} س',
    rate: 'قيّم تجربتك', rated: '✅ شكراً على تقييمك!', contact: 'تواصل معنا',
    supportNote: '💡 لو المساعد مجاوبش على سؤالك، كلّم الدعم مباشرة.',
    close: 'إغلاق',
  },
  en: {
    menu: 'Menu', chats: 'Chats', settings: 'Settings',
    ask: 'Starter questions', support: 'Support',
    empty: 'No saved conversations yet.',
    restore: 'Restore', remove: 'Delete',
    replyLang: 'Reply language', auto: 'Auto', arabic: 'Arabic', english: 'English',
    replyLen: 'Reply length', short: 'Short', detailed: 'Detailed',
    clearAll: 'Clear all conversations', confirm: 'Sure? This cannot be undone',
    now: 'just now', minsAgo: '{n}m ago', hoursAgo: '{n}h ago',
    rate: 'Rate your experience', rated: '✅ Thanks for your rating!', contact: 'Contact us',
    supportNote: "💡 If the assistant couldn't answer, reach a human directly.",
    close: 'Close',
  },
} as const;

/**
 * Real support channels — NOT app links. The /ai page already had these in a private
 * right-hand panel while the Hub drawer had none; keeping them here means one surface
 * cannot silently have support the other lacks (the drift this component exists to stop).
 */
const SUPPORT_LINKS = [
  { emoji: '📱', label: 'WhatsApp', href: 'https://wa.me/201115141346',      color: '#25D366' },
  { emoji: '✈️', label: 'Telegram', href: 'https://t.me/Yasira17',           color: '#229ED9' },
  { emoji: '📧', label: 'Email',    href: 'mailto:yasserrr.fox17@gmail.com', color: 'var(--tec-gold)' },
  { emoji: '📞', label: 'Call',     href: 'tel:+201115141346',               color: '#7ee7c0' },
] as const;

/** Questions that FILL THE INPUT — they ask the assistant, they do not navigate away. */
const STARTERS = {
  ar: ['ايه هو TEC؟', 'إزاي أدفع بـ Pi؟', 'أنهي تطبيق يناسبني؟', 'إيه الفرق بين التطبيقات؟', 'إزاي أعمل KYC؟'],
  en: ['What is TEC?', 'How do I pay with Pi?', 'Which app fits me?', 'How do the apps differ?', 'How do I complete KYC?'],
} as const;

type Tab = 'chats' | 'settings' | 'ask' | 'support';

type Copy = { now: string; minsAgo: string; hoursAgo: string };

function ago(at: number, tr: Copy): string {
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1)  return tr.now;
  if (mins < 60) return tr.minsAgo.replace('{n}', String(mins));
  return tr.hoursAgo.replace('{n}', String(Math.floor(mins / 60)));
}

export interface AIMenuProps {
  storeKey: string;
  locale:   'ar' | 'en';
  /** Called with the restored turns so the surface can rebuild its own message shape. */
  onRestore: (turns: StoredTurn[]) => void;
  /** Fill the composer with a starter question. */
  onAsk:     (question: string) => void;
  /** The surface clears its live thread when everything is wiped. */
  onClearAll: () => void;
  onSettingsChange?: (s: AiSettings) => void;
  onClose:   () => void;
}

export function AIMenu({
  storeKey, locale, onRestore, onAsk, onClearAll, onSettingsChange, onClose,
}: AIMenuProps) {
  const tr  = L[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const [tab,      setTab]      = useState<Tab>('chats');
  const [archives, setArchives] = useState<ArchivedChat[]>(() => listArchives(storeKey));
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [confirming, setConfirming] = useState(false);
  const [rating,   setRating]   = useState(0);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    onSettingsChange?.(next);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'chats',    label: tr.chats,    icon: '🗂' },
    { id: 'ask',      label: tr.ask,      icon: '💡' },
    { id: 'settings', label: tr.settings, icon: '⚙️' },
    { id: 'support',  label: tr.support,  icon: '💬' },
  ];

  return (
    <div dir={dir} style={S.wrap}>
      <div style={S.head}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{tr.menu}</span>
        <button onClick={onClose} aria-label={tr.close} style={S.close}>✕</button>
      </div>

      <div style={S.tabs} role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabOn : null) }}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={S.body}>
        {tab === 'chats' && (
          archives.length === 0
            ? <p style={S.empty}>{tr.empty}</p>
            : archives.map(a => (
                <div key={a.id} style={S.row}>
                  <button
                    onClick={() => { onRestore(restoreArchive(storeKey, a.id)); setArchives(listArchives(storeKey)); onClose(); }}
                    style={S.rowMain} title={tr.restore}>
                    <span dir="auto" style={S.rowTitle}>{a.title || '—'}</span>
                    <span style={S.rowMeta}>{ago(a.at, tr)} · {a.turns.length}</span>
                  </button>
                  <button
                    onClick={() => { deleteArchive(storeKey, a.id); setArchives(listArchives(storeKey)); }}
                    aria-label={tr.remove} style={S.rowDel}>✕</button>
                </div>
              ))
        )}

        {tab === 'ask' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STARTERS[locale].map(q => (
              <button key={q} onClick={() => { onAsk(q); onClose(); }} style={S.starter} dir="auto">{q}</button>
            ))}
          </div>
        )}

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Choice label={tr.replyLang} value={settings.replyLocale}
              options={[['auto', tr.auto], ['ar', tr.arabic], ['en', tr.english]]}
              onPick={v => update({ replyLocale: v as AiSettings['replyLocale'] })} />
            <Choice label={tr.replyLen} value={settings.replyLength}
              options={[['detailed', tr.detailed], ['short', tr.short]]}
              onPick={v => update({ replyLength: v as AiSettings['replyLength'] })} />

            {/* Destructive, so it asks once. Nothing here is recoverable afterwards. */}
            <button
              onClick={() => {
                if (!confirming) { setConfirming(true); return; }
                clearAll(storeKey);
                setArchives([]); setConfirming(false);
                onClearAll(); onClose();
              }}
              style={{ ...S.danger, ...(confirming ? S.dangerArmed : null) }}>
              {confirming ? tr.confirm : tr.clearAll}
            </button>
          </div>
        )}

        {tab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={S.groupTitle}>{tr.rate}</div>
              {rating > 0
                ? <p style={S.rated}>{tr.rated}</p>
                : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)}
                        aria-label={`${star}`} style={S.star}>★</button>
                    ))}
                  </div>
                )}
            </div>

            <div>
              <div style={S.groupTitle}>{tr.contact}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUPPORT_LINKS.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                     style={{ ...S.support, borderColor: `${l.color}30` }}>
                    <span aria-hidden style={{ fontSize: 15 }}>{l.emoji}</span>
                    <span style={{ flex: 1 }}>{l.label}</span>
                    <span aria-hidden style={{ opacity: 0.5, fontSize: 11 }}>↗</span>
                  </a>
                ))}
              </div>
            </div>

            <p style={S.note}>{tr.supportNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Choice({ label, value, options, onPick }: {
  label: string; value: string; options: [string, string][]; onPick: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#7a7a8a', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(([v, text]) => (
          <button key={v} onClick={() => onPick(v)} aria-pressed={value === v}
            style={{ ...S.opt, ...(value === v ? S.optOn : null) }}>{text}</button>
        ))}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:  { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },
  head:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px' },
  close: { background: 'none', border: 'none', color: '#7a7a8a', cursor: 'pointer', fontSize: 16, padding: 4 },
  /* WRAP, never scroll. With overflowX the fourth tab sat off the right edge with no hint
     it existed — a menu entry you cannot see is a menu entry you do not have. */
  tabs:  { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tab:   { padding: '6px 12px', borderRadius: 999, border: '1px solid #ffffff14', background: 'transparent',
           color: '#8a8a9a', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  tabOn: { background: '#FBBF2414', borderColor: '#FBBF2440', color: 'var(--tec-gold)', fontWeight: 600 },
  body:  { flex: 1, overflowY: 'auto', minHeight: 0 },
  empty: { color: '#5a5a6a', fontSize: 12, textAlign: 'center', padding: '24px 8px' },
  row:   { display: 'flex', alignItems: 'stretch', gap: 6, marginBottom: 6 },
  rowMain: { flex: 1, textAlign: 'start', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
             border: '1px solid #ffffff10', background: '#ffffff06', color: '#fff',
             display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'inherit', minWidth: 0 },
  rowTitle: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { fontSize: 10, color: '#5a5a6a' },
  rowDel: { width: 34, borderRadius: 12, border: '1px solid #ffffff10', background: 'transparent',
            color: '#5a5a6a', cursor: 'pointer', fontSize: 12 },
  starter: { textAlign: 'start', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
             border: '1px solid #FBBF2430', background: '#FBBF240A', color: 'var(--tec-gold)',
             fontSize: 12, fontFamily: 'inherit' },
  opt:   { padding: '6px 12px', borderRadius: 999, border: '1px solid #ffffff14',
           background: 'transparent', color: '#8a8a9a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  optOn: { background: '#FBBF2414', borderColor: '#FBBF2440', color: 'var(--tec-gold)', fontWeight: 600 },
  danger: { marginTop: 4, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            border: '1px solid #EF444430', background: 'transparent', color: 'var(--tec-red)',
            fontSize: 12, fontFamily: 'inherit' },
  dangerArmed: { background: '#EF444418', borderColor: '#EF444460', fontWeight: 700 },
  groupTitle: { fontSize: 11, color: '#7a7a8a', marginBottom: 8 },
  star:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 22,
           color: '#FBBF2433', padding: 2, lineHeight: 1 },
  rated: { fontSize: 12, color: 'var(--tec-green)', margin: 0 },
  support: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
             borderRadius: 12, border: '1px solid #ffffff10', background: '#ffffff06',
             color: '#e8e0d0', fontSize: 12, textDecoration: 'none' },
  note:  { fontSize: 11, color: '#5a5a6a', lineHeight: 1.7, margin: 0 },
};
