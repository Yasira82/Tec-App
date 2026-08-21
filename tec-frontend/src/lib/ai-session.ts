/**
 * Conversation persistence for the TEC AI surfaces.
 *
 * Without this the assistant forgets everything the moment the drawer closes or the page
 * reloads — you ask a question, navigate to the app it recommended, come back, and the
 * thread is gone. For an assistant that is the single largest quality gap.
 *
 * **sessionStorage, deliberately — not localStorage.** A transcript is personal content:
 * it can name goals, balances, and what the user is trying to do. sessionStorage dies
 * with the tab, so a shared or borrowed device does not hand the next person a history.
 * It is also not a token, so it does not touch the ADR-001 rule (tokens are cookie-only,
 * never storage) — but it is close enough to that line to be worth stating.
 *
 * Every access is wrapped: Pi Browser and private modes can make storage throw on read
 * OR write, and a chat assistant that crashes because it could not save a draft is worse
 * than one that quietly forgets (fail-soft, never fail-loud).
 */

/** Keep the tail only — an unbounded transcript will eventually blow the storage quota. */
const MAX_TURNS = 40;

export interface StoredTurn {
  role: string;
  text: string;
}

export function loadConversation<T extends StoredTurn>(key: string): T[] {
  try {
    const raw = sessionStorage.getItem(key);
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
    sessionStorage.setItem(key, JSON.stringify(settled.slice(-MAX_TURNS)));
  } catch {
    /* quota, private mode, or storage disabled — forgetting beats crashing */
  }
}

export function clearConversation(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* nothing to do — the caller has already cleared its own state */
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────
// "New chat" used to DELETE the thread outright, so one mis-tap lost the conversation
// with no way back. Starting a new chat is not the same intent as destroying the old one.
//
// This is now a real LIST, not a single slot: the menu shows past conversations and any
// one of them can be restored. Still sessionStorage, still tab-scoped — the reasoning at
// the top of this file applies to an archive exactly as it applies to a live thread.

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
    const raw = sessionStorage.getItem(archiveKey(key));
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
    sessionStorage.setItem(archiveKey(key), JSON.stringify(list.slice(0, MAX_ARCHIVES)));
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
  try { sessionStorage.removeItem(archiveKey(key)); } catch { /* already gone */ }
}

// ── Assistant settings ────────────────────────────────────────────────────────
// Preferences, NOT content: which language to answer in and how long an answer should
// be. localStorage (not session) because a preference the user has to set again every
// tab is not a preference. Nothing here is personal content and nothing is a token.

export type ReplyLocale = 'auto' | 'ar' | 'en';
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
      replyLocale: p.replyLocale === 'ar' || p.replyLocale === 'en' ? p.replyLocale : 'auto',
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
