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
