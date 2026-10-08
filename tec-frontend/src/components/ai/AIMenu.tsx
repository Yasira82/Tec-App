'use client';

import { useEffect, useState } from 'react';
import {
  listArchives, restoreArchive, deleteArchive, clearAll,
  loadSettings, saveSettings,
  type ArchivedChat, type AiSettings, type StoredTurn,
} from '@/lib/ai-session';
import { DICTIONARIES, type Locale } from '@/lib/i18n';
import { LOCALES, localeInfo } from '@/lib/locales';

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

// The menu's words live in the dictionary (hub.aiMenu, hub.ai.starters) — in all
// twelve languages. They used to be a local en/ar table here, so a third language
// would have fallen back to English inside the assistant itself.

/**
 * Real support channels — NOT app links. The /ai page already had these in a private
 * right-hand panel while the Hub drawer had none; keeping them here means one surface
 * cannot silently have support the other lacks (the drift this component exists to stop).
 */
const SUPPORT_LINKS = [
  // 201109742713 — one number for both WhatsApp and Call, as it was before.
  // `Call` was held on the old line for a round while only "the WhatsApp number
  // changed" had been said; the owner then confirmed the phone moved too.
  { emoji: '📱', label: 'WhatsApp', href: 'https://wa.me/201109742713',      color: '#25D366' },
  // A group INVITE link, replacing the personal @Yasira17 handle. An invite is
  // revocable from inside Telegram; a handle is not, and it also pointed at one
  // person's account rather than at the platform.
  { emoji: '✈️', label: 'Telegram', href: 'https://t.me/+7yEiJGgSZ2QzM2M0',  color: '#229ED9' },
  { emoji: '📧', label: 'Email',    href: 'mailto:yasserrr.fox17@gmail.com', color: 'var(--tec-gold)' },
  // Same number as WhatsApp above — they are one line, and a support panel that
  // offers two different numbers makes the user choose which one is real.
  // +20 is the dialling form; wa.me above takes the same digits without the +.
  { emoji: '📞', label: 'Call',     href: 'tel:+201109742713',               color: '#7ee7c0' },
] as const;

/**
 * Social — where TEC can be found, as opposed to how support is reached.
 *
 * Separate from SUPPORT_LINKS on purpose: one is "I need help now", the other
 * is "who are these people". Mixing them puts a Facebook page next to a phone
 * number under a heading that says Contact us, and the person in trouble has to
 * read five options to find the two that answer.
 *
 * ⚠️ The Facebook URL is a /share/ link, which Facebook mints per share and can
 * regenerate — the same profile produced two different ones thirteen minutes
 * apart. It resolves today and can stop with no error on our side. The durable
 * form is facebook.com/<username>; replace it here the moment one exists.
 */
const SOCIAL_LINKS = [
  { emoji: '📘', label: 'Facebook', href: 'https://www.facebook.com/share/198YXN8kaF/', color: '#4267B2' },
  { emoji: '✕',  label: 'X',        href: 'https://x.com/TEC1c5',                       color: 'var(--tec-text)' },
] as const;

/** Questions that FILL THE INPUT — they ask the assistant, they do not navigate away. */


type Tab = 'chats' | 'settings' | 'ask' | 'support';

/** The `seen` block of /api/bff/ai/context — what Life actually handed the assistant. */
interface Seen {
  life:    'read' | 'no_profile' | 'unavailable' | 'not_asked';
  consent: Record<string, boolean>;
  goals:   number;
  skills:  number | null;
  pace:    boolean;
}

/**
 * "What TEC AI can see now" — read fresh each time Settings opens, so switching a
 * category in Life shows here on the next look. The second reading asked "can you
 * see my goals in Life?"; this answers it from the read itself, not from the model.
 */
function SeesBlock({ dict }: { dict: (typeof DICTIONARIES)['en'] }) {
  const tr  = dict.hub.aiMenu;
  const cat = dict.hub.adminLifeAi.categories;
  const [seen, setSeen] = useState<Seen | null | 'loading'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res  = await fetch('/api/bff/ai/context', { credentials: 'include', cache: 'no-store' });
        const body = res.ok ? await res.json().catch(() => null) : null;
        if (alive) setSeen((body as { seen?: Seen } | null)?.seen ?? null);
      } catch { if (alive) setSeen(null); }
    })();
    return () => { alive = false; };
  }, []);

  const row = (label: string, value: string, on: boolean) => (
    <div key={label} style={S.seesRow}>
      <span>{label}</span>
      <span style={{ color: on ? '#4ade80' : '#7a7a8a' }}>{on ? '✓ ' : '✗ '}{value}</span>
    </div>
  );

  let content: React.ReactNode;
  if (seen === 'loading') content = <p style={S.seesNote}>{tr.seesChecking}</p>;
  else if (!seen || seen.life === 'not_asked') content = <p style={S.seesNote}>{tr.seesSignedOut}</p>;
  else if (seen.life === 'no_profile')   content = <p style={S.seesNote}>{tr.seesNoProfile}</p>;
  else if (seen.life === 'unavailable')  content = <p style={S.seesNote}>{tr.seesUnavailable}</p>;
  else {
    const g = seen.consent.GOALS === true;
    const k = seen.consent.SKILLS === true;
    const t = seen.consent.TRAJECTORY === true;
    content = (
      <>
        {row(cat.GOALS,  !g ? tr.seesNotShared : seen.goals ? tr.seesShared.replace('{n}', String(seen.goals)) : tr.seesNoneActive, g)}
        {row(cat.SKILLS, !k ? tr.seesNotShared : seen.skills ? tr.seesShared.replace('{n}', String(seen.skills)) : tr.seesNoneActive, k)}
        {row(cat.TRAJECTORY, t ? tr.seesOn : tr.seesNotShared, t)}
        <p style={S.seesNote}>{tr.seesHow}</p>
      </>
    );
  }

  return (
    <div data-testid="ai-sees">
      <div style={S.groupTitle}>{tr.seesTitle}</div>
      {content}
    </div>
  );
}

type Copy = { now: string; minsAgo: string; hoursAgo: string };

function ago(at: number, tr: Copy): string {
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1)  return tr.now;
  if (mins < 60) return tr.minsAgo.replace('{n}', String(mins));
  return tr.hoursAgo.replace('{n}', String(Math.floor(mins / 60)));
}

export interface AIMenuProps {
  storeKey: string;
  locale:   Locale;
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
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
  const tr   = dict.hub.aiMenu;
  const dir  = localeInfo(locale).dir;

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
            {dict.hub.ai.starters.map(q => (
              <button key={q} onClick={() => { onAsk(q); onClose(); }} style={S.starter} dir="auto">{q}</button>
            ))}
          </div>
        )}

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SeesBlock dict={dict} />
            <Choice label={tr.replyLang} value={settings.replyLocale}
              options={[['auto', tr.auto], ...LOCALES.map((l) => [l.code, l.native] as [string, string])]}
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

            <div>
              <div style={S.groupTitle}>{tr.social}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SOCIAL_LINKS.map(l => (
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
  tabOn: { background: 'var(--tec-gold)14', borderColor: 'var(--tec-gold)40', color: 'var(--tec-gold)', fontWeight: 600 },
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
             border: '1px solid var(--tec-gold)30', background: 'var(--tec-gold)0A', color: 'var(--tec-gold)',
             fontSize: 12, fontFamily: 'inherit' },
  opt:   { padding: '6px 12px', borderRadius: 999, border: '1px solid #ffffff14',
           background: 'transparent', color: '#8a8a9a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  optOn: { background: 'var(--tec-gold)14', borderColor: 'var(--tec-gold)40', color: 'var(--tec-gold)', fontWeight: 600 },
  danger: { marginTop: 4, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            border: '1px solid #EF444430', background: 'transparent', color: 'var(--tec-red)',
            fontSize: 12, fontFamily: 'inherit' },
  dangerArmed: { background: '#EF444418', borderColor: '#EF444460', fontWeight: 700 },
  groupTitle: { fontSize: 11, color: '#7a7a8a', marginBottom: 8 },
  seesRow:    { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#d4d4dc', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  seesNote:   { fontSize: 11, color: '#7a7a8a', margin: '6px 0 0', lineHeight: 1.5 },
  star:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 22,
           color: 'var(--tec-gold)33', padding: 2, lineHeight: 1 },
  rated: { fontSize: 12, color: 'var(--tec-green)', margin: 0 },
  support: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
             borderRadius: 12, border: '1px solid #ffffff10', background: '#ffffff06',
             color: '#e8e0d0', fontSize: 12, textDecoration: 'none' },
  note:  { fontSize: 11, color: '#5a5a6a', lineHeight: 1.7, margin: 0 },
};
