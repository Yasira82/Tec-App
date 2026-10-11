/**
 * Conversation persistence for the TEC AI surfaces.
 *
 * Without this the assistant forgets everything the moment the drawer closes or the page
 * reloads — you ask a question, navigate to the app it recommended, come back, and the
 * thread is gone. For an assistant that is the single largest quality gap.
 *
 * **Where it is kept.** A transcript is personal content: it can name goals, balances,
 * and what the user is trying to do.
 *
 *   - A SIGNED-IN person: localStorage, under a key scoped to their account. It used to be
 *     sessionStorage for everyone, and Pi Browser closes tabs freely — the owner lost every
 *     conversation (2026-10-11). Scoped per account, one person never sees another's on a
 *     shared phone; they review and delete them from the assistant's menu (restore · delete
 *     one · clear all); and signing out wipes every conversation on the device
 *     (`forgetAllConversations`, called by `logout()`).
 *   - A GUEST: sessionStorage, as before — nothing outlives the tab without an account.
 *
 * It is not a token, so it does not touch the ADR-001 rule (tokens are cookie-only, never
 * storage) — but it is close enough to that line to be worth stating.
 *
 * Every access is wrapped: Pi Browser and private modes can make storage throw on read
 * OR write, and a chat assistant that crashes because it could not save a draft is worse
 * than one that quietly forgets (fail-soft, never fail-loud).
 */

/** Keep the tail only — an unbounded transcript will eventually blow the storage quota. */
import { isLocaleCode, type LocaleCode } from '@/lib/locales';
const MAX_TURNS = 40;

/** The two surfaces that store conversations. Every key this file writes starts with one. */
const SURFACES = ['tec_ai_page', 'tec_ai_drawer'] as const;

/**
 * The signed-in account, from the `tec_user` cookie — or null for a guest. Read here and
 * not from a hook so storage stays a plain function. Decoded until it parses: a cookie
 * written before 2026-10-10 was encoded twice.
 */
function owner(): string | null {
  try {
    const row = document.cookie.split('; ').find(r => r.startsWith('tec_user='));
    if (!row) return null;
    let v = row.slice('tec_user='.length);
    for (let i = 0; i < 3; i++) {
      try {
        const u = JSON.parse(v) as { id?: unknown; piUsername?: unknown };
        const id = typeof u?.id === 'string' && u.id ? u.id
                 : typeof u?.piUsername === 'string' && u.piUsername ? u.piUsername : null;
        return id;
      } catch { v = decodeURIComponent(v); }
    }
    return null;
  } catch {
    return null;
  }
}

/** Where `key` lives for whoever is signed in now. */
function slot(key: string): { store: Storage; name: string } {
  const who = owner();
  return who ? { store: localStorage, name: `${key}@${who}` } : { store: sessionStorage, name: key };
}

function getItem(key: string): string | null {
  const { store, name } = slot(key);
  const v = store.getItem(name);
  if (v !== null || store === sessionStorage) return v;
  // Signed in, nothing on the device yet: a conversation kept only in this tab (before
  // this change, or from before signing in) moves to the device instead of vanishing.
  const tabOnly = sessionStorage.getItem(key);
  if (tabOnly !== null) {
    store.setItem(name, tabOnly);
    sessionStorage.removeItem(key);
  }
  return tabOnly;
}
function setItem(key: string, value: string): void {
  const { store, name } = slot(key);
  store.setItem(name, value);
}
function removeItem(key: string): void {
  const { store, name } = slot(key);
  store.removeItem(name);
  if (store !== sessionStorage) sessionStorage.removeItem(key);
}

/**
 * Every conversation on this device, for every account — live threads and archives —
 * and nothing else (settings, carts and other keys are left alone). Called on sign-out.
 */
export function forgetAllConversations(): void {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const s = store();
      const doomed: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && SURFACES.some(p => k === p || k.startsWith(`${p}@`) || k.startsWith(`${p}:`))) doomed.push(k);
      }
      doomed.forEach(k => s.removeItem(k));
    } catch {
      /* storage disabled — there is nothing kept to forget */
    }
  }
}

export interface StoredTurn {
  role: string;
  text: string;
}

export function loadConversation<T extends StoredTurn>(key: string): T[] {
  try {
    const raw = getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Validate every entry: a half-written or hand-edited value must not reach React as
    // a message object with missing fields.
    return parsed.filter(
      (m): m is T =>
        !!m && typeof m === 'object' &&
        typeof (m as StoredTurn).role === 'string' &&
        typeof (m as StoredTurn).text === 'string',
    );
  } catch {
    return [];
  }
}

export function saveConversation(key: string, turns: StoredTurn[]): void {
  try {
    // A reply still being streamed is not saved mid-flight — a half-sentence restored on
    // reload would look like the assistant broke.
    const settled = turns.filter(t => t.text.trim());
    setItem(key, JSON.stringify(settled.slice(-MAX_TURNS)));
  } catch {
    /* quota, private mode, or storage disabled — forgetting beats crashing */
  }
}

export function clearConversation(key: string): void {
  try {
    removeItem(key);
  } catch {
    /* nothing to do — the caller has already cleared its own state */
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────
// "New chat" used to DELETE the thread outright, so one mis-tap lost the conversation
// with no way back. Starting a new chat is not the same intent as destroying the old one.
//
// This is now a real LIST, not a single slot: the menu shows past conversations and any
// one of them can be restored. Kept exactly where the live thread is kept (see the top of
// this file) — the same account scope, the same wipe on sign-out.

/** How many past conversations are kept. Old ones fall off the end. */
const MAX_ARCHIVES = 10;

export interface ArchivedChat {
  id:    string;
  /** First thing the user asked — what makes the entry recognisable in a list. */
  title: string;
  /** Epoch ms, for "2h ago". */
  at:    number;
  turns: StoredTurn[];
}

const archiveKey = (key: string) => `${key}:archive`;

function readArchives(key: string): ArchivedChat[] {
  try {
    const raw = getItem(archiveKey(key));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a): a is ArchivedChat =>
      !!a && typeof a === 'object' &&
      typeof (a as ArchivedChat).id === 'string' &&
      Array.isArray((a as ArchivedChat).turns));
  } catch {
    return [];
  }
}

function writeArchives(key: string, list: ArchivedChat[]): void {
  try {
    setItem(archiveKey(key), JSON.stringify(list.slice(0, MAX_ARCHIVES)));
  } catch {
    /* quota or storage disabled — losing an archive beats crashing the assistant */
  }
}

/** The first user line, trimmed to something that fits a menu row. */
function titleOf(turns: StoredTurn[]): string {
  const firstAsk = turns.find(t => t.role === 'user')?.text.trim();
  const raw = firstAsk || turns[0]?.text.trim() || '';
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
}

/** Move the current thread into the archive instead of deleting it. */
export function archiveConversation(key: string): void {
  const turns = loadConversation(key);
  // Nothing worth keeping? Then leave the archive alone — clearing an empty thread must
  // not disturb conversations the user might still want back.
  if (!turns.length) { clearConversation(key); return; }

  writeArchives(key, [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: titleOf(turns), at: Date.now(), turns },
    ...readArchives(key),
  ]);
  clearConversation(key);
}

export function listArchives(key: string): ArchivedChat[] {
  return readArchives(key);
}

export function hasArchive(key: string): boolean {
  return readArchives(key).length > 0;
}

/** Bring one archived thread back as the live conversation, and take it off the list. */
export function restoreArchive<T extends StoredTurn>(key: string, id: string): T[] {
  const list  = readArchives(key);
  const found = list.find(a => a.id === id);
  if (!found) return [];
  // The live thread is archived first — restoring must never silently discard whatever
  // the user is in the middle of.
  archiveConversation(key);
  saveConversation(key, found.turns);
  writeArchives(key, readArchives(key).filter(a => a.id !== id));
  return found.turns as T[];
}

export function deleteArchive(key: string, id: string): void {
  writeArchives(key, readArchives(key).filter(a => a.id !== id));
}

/** Wipe everything this surface stored — live thread and every archive. */
export function clearAll(key: string): void {
  clearConversation(key);
  try { removeItem(archiveKey(key)); } catch { /* already gone */ }
}

// ── Assistant settings ────────────────────────────────────────────────────────
// Preferences, NOT content: which language to answer in and how long an answer should
// be. localStorage (not session) because a preference the user has to set again every
// tab is not a preference. Nothing here is personal content and nothing is a token.

export type ReplyLocale = 'auto' | LocaleCode;
export type ReplyLength = 'short' | 'detailed';

export interface AiSettings {
  replyLocale: ReplyLocale;
  replyLength: ReplyLength;
}

const SETTINGS_KEY = 'tec_ai_settings';
export const DEFAULT_SETTINGS: AiSettings = { replyLocale: 'auto', replyLength: 'detailed' };

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<AiSettings>;
    return {
      // Validate against the allowed values — a hand-edited value must not become a
      // locale the route has never heard of.
      replyLocale: isLocaleCode(p.replyLocale) ? p.replyLocale : 'auto',
      replyLength: p.replyLength === 'short' ? 'short' : 'detailed',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage disabled — the setting applies to this session and is simply not kept */
  }
}
