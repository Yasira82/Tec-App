/**
 * TEC AI conversations — the server copy (C-104 §5.4 · tec-core-backend #411).
 *
 * `lib/ai-session.ts` keeps the device copy and calls this SINK on every change;
 * this sends it to `/api/bff/ai/history`. Three rules:
 *
 *   - The person never waits on it. Saves are debounced (a streamed reply settles
 *     into one save) and every call is fire-and-forget, in ORDER: one queue, so an
 *     archive never overtakes the save it archives.
 *   - Only what was said travels: role (user · assistant) and text. Thumbnails,
 *     intents and a reply still streaming stay on the device.
 *   - The server is the record. When the assistant opens, `hydrate` replaces the
 *     device copy with it; if the server has nothing yet and the device does, the
 *     device's conversations are uploaded once instead of being lost.
 *
 * When the server is unreachable or not deployed, every call fails quietly and the
 * device copy carries on — the assistant must never break because history could
 * not be saved.
 */
import {
  type ArchivedChat, type ConversationSink, type StoredTurn,
  loadConversation, listArchives, replaceFromServer, setConversationSink, isSignedIn,
} from '@/lib/ai-session';

/** The double-submit CSRF value (the middleware checks it on every POST). */
const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((r) => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

const URL_ = '/api/bff/ai/history';
const SURFACES = ['tec_ai_drawer', 'tec_ai_page'] as const;
type Surface = (typeof SURFACES)[number];
const isSurface = (k: string): k is Surface => (SURFACES as readonly string[]).includes(k);
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** How long a save waits for more changes — a streamed answer settles into one request. */
export const SAVE_DEBOUNCE_MS = 1200;

/** Device turns → what the server keeps: settled user/assistant text, nothing else. */
export function toServerTurns(turns: StoredTurn[]): { role: 'user' | 'assistant'; text: string }[] {
  return turns
    .filter((t) => !(t as { streaming?: boolean }).streaming && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({ role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', text: t.text.slice(0, 8000) }))
    .filter((t, i, all) => i >= all.length - 40);
}
/** Server turns → device turns (the chat UI calls the assistant `ai`). */
export function fromServerTurns(turns: unknown): StoredTurn[] {
  return (Array.isArray(turns) ? turns : [])
    .filter((t): t is { role: string; text: string } => !!t && typeof (t as { text?: unknown }).text === 'string')
    .map((t) => ({ role: t.role === 'user' ? 'user' : 'ai', text: t.text }));
}
function fromServerArchives(list: unknown): ArchivedChat[] {
  return (Array.isArray(list) ? list : [])
    .filter((a): a is { id: string; title?: unknown; at?: unknown; turns?: unknown } => !!a && typeof (a as { id?: unknown }).id === 'string')
    .map((a) => ({
      id:    a.id,
      title: typeof a.title === 'string' ? a.title : '',
      at:    typeof a.at === 'number' ? a.at : Date.now(),
      turns: fromServerTurns(a.turns),
    }));
}

let queue: Promise<unknown> = Promise.resolve();
const enqueue = (op: () => Promise<unknown>): Promise<unknown> => (queue = queue.then(op).catch(() => undefined));
const timers  = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, StoredTurn[]>();

function post(body: Record<string, unknown>): Promise<Response> {
  return fetch(URL_, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    body:        JSON.stringify(body),
  });
}

async function readState(surface: Surface): Promise<{ live: StoredTurn[] | null; archives: ArchivedChat[] } | null> {
  try {
    const res = await fetch(`${URL_}?surface=${surface}`, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null) as { available?: boolean; live?: unknown; archives?: unknown } | null;
    if (!body?.available) return null;
    return { live: body.live ? fromServerTurns(body.live) : null, archives: fromServerArchives(body.archives) };
  } catch {
    return null;
  }
}

/** Send a pending save now — before an operation that must come after it. */
function flush(key: Surface): void {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  const turns = pending.get(key);
  if (!turns) return;
  pending.delete(key);
  void enqueue(() => post({ action: 'save', surface: key, turns: toServerTurns(turns) }));
}

/** After an archive or restore: take the server's list, so ids name the server's rows. */
function refreshArchives(key: Surface): void {
  void enqueue(async () => {
    const s = await readState(key);
    if (s) replaceFromServer(key, null, s.archives, true);
  });
}

export const serverSink: ConversationSink = {
  save(key, turns) {
    if (!isSurface(key)) return;
    pending.set(key, turns);
    const t = timers.get(key);
    if (t) clearTimeout(t);
    timers.set(key, setTimeout(() => flush(key), SAVE_DEBOUNCE_MS));
  },
  archive(key) {
    if (!isSurface(key)) return;
    flush(key);
    void enqueue(() => post({ action: 'archive', surface: key }));
    refreshArchives(key);
  },
  restore(key, id) {
    if (!isSurface(key) || !isUuid(id)) return;
    flush(key);
    void enqueue(() => post({ action: 'restore', surface: key, id }));
    refreshArchives(key);
  },
  remove(key, id) {
    if (!isUuid(id)) return;
    void enqueue(() => post({ action: 'delete', id }));
  },
  clear(key) {
    if (!isSurface(key)) return;
    pending.delete(key);
    const t = timers.get(key); if (t) { clearTimeout(t); timers.delete(key); }
    void enqueue(() => post({ action: 'clear', surface: key }));
  },
};

/**
 * Install the sink and bring the server's copy onto the device. Returns the live
 * thread to show, or null when the device copy should stay (guest, server
 * unavailable, or nothing there yet — in which case the device's conversations
 * are uploaded so they are not lost).
 */
export async function hydrate(key: string): Promise<StoredTurn[] | null> {
  setConversationSink(serverSink);
  if (!isSurface(key) || !isSignedIn()) return null;
  const server = await readState(key);
  if (!server) return null;
  if (!server.live && !server.archives.length) {
    const live = loadConversation(key);
    const archives = listArchives(key);
    if (live.length || archives.length) {
      // Oldest first, so the server's archive keeps the device's order.
      for (const a of [...archives].reverse()) {
        void enqueue(() => post({ action: 'save', surface: key, turns: toServerTurns(a.turns) }));
        void enqueue(() => post({ action: 'archive', surface: key }));
      }
      if (live.length) void enqueue(() => post({ action: 'save', surface: key, turns: toServerTurns(live) }));
      refreshArchives(key);
    }
    return null;
  }
  replaceFromServer(key, server.live, server.archives);
  return server.live ?? [];
}

/** Test seam: wait for every queued call. */
export const settled = (): Promise<unknown> => queue;
