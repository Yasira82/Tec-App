/**
 * Client-side plumbing for the TEC AI chat stream.
 *
 * Two things used to happen inside the drawer component, and both were wrong in a way
 * that only shows up in production:
 *
 * 1. SSE frames were parsed per network chunk (`chunk.split('\n')`) with NO carry-over
 *    buffer. A `data: {...}` line that lands across two chunk boundaries — routine on a
 *    mobile connection — parsed as invalid JSON and was swallowed by a bare `catch`.
 *    The answer then appeared to stop mid-sentence with no error anywhere. The server's
 *    own transform buffers exactly like this; the client simply did not.
 * 2. The reply was rendered as a raw string, so the model's `**bold**` reached the
 *    screen as literal asterisks.
 *
 * Both are pure functions here so they can be tested against real chunk splits instead
 * of being trapped inside a component render.
 */

export interface StreamDelta {
  /** Text decoded from the frames in this chunk (may be empty). */
  text: string;
  /** The provider stopped because it hit its output cap — the answer is incomplete. */
  truncated: boolean;
}

export interface SseReader {
  /** Feed one decoded network chunk; returns whatever was completed by it. */
  push(chunk: string): StreamDelta;
  /** Call once the stream ends, to drain a final line that arrived without a newline. */
  flush(): StreamDelta;
}

const EMPTY: StreamDelta = { text: '', truncated: false };

/**
 * Line-buffered SSE reader. A partial trailing line is held back until the rest of it
 * arrives, so no delta is ever lost to a chunk boundary.
 */
export function createSseReader(): SseReader {
  let buffer = '';

  const consume = (lines: string[]): StreamDelta => {
    let text = '';
    let truncated = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          text?:      unknown;
          truncated?: unknown;
          delta?:     { text?: unknown };
          content?:   { text?: unknown }[];
        };
        // `{text}` is the contract our route emits — every provider is normalised to it
        // server-side. `delta.text` / `content[0].text` are raw-Anthropic shapes the /ai
        // page has tolerated since before that normalisation existed; kept so a stream
        // that reached a client unnormalised still renders rather than silently vanishing.
        const delta =
          typeof parsed.text === 'string'          ? parsed.text
          : typeof parsed.delta?.text === 'string' ? parsed.delta.text
          : typeof parsed.content?.[0]?.text === 'string' ? parsed.content[0].text
          : '';
        if (delta) text += delta;
        if (parsed.truncated === true) truncated = true;
      } catch {
        // A frame we cannot parse is skipped, but only AFTER buffering has had its
        // chance — so this now means "unknown frame", never "arrived in two pieces".
      }
    }
    return { text, truncated };
  };

  return {
    push(chunk: string): StreamDelta {
      if (!chunk) return EMPTY;
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';   // keep the incomplete tail for the next chunk
      return consume(lines);
    },
    flush(): StreamDelta {
      if (!buffer) return EMPTY;
      const rest = buffer;
      buffer = '';
      return consume(rest.split('\n'));
    },
  };
}

// ── Minimal markdown ──────────────────────────────────────────────────────────
// Only what the models actually emit in chat answers: bold, inline code, bullets and
// headings. No dependency (Pi Browser renders these as plain inline-styled spans) and
// no HTML injection — the text is never interpreted as markup, only tokenised.

export type RichToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string; href: string };

export type RichLine =
  | { kind: 'text' | 'bullet' | 'heading' | 'rule'; tokens: RichToken[] }
  /** A markdown table. Without this the pipes reached the screen as raw `| a | b |`. */
  | { kind: 'table'; header: RichToken[][]; rows: RichToken[][][] };

/** `| a | b |` → ['a', 'b'] — outer pipes dropped, inner cells trimmed. */
function splitRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

const isTableRow  = (l: string) => /\|/.test(l) && l.trim().startsWith('|');
/** The `|---|:--:|` line directly under a header is what makes a table a table. */
const isTableRule = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && /\|/.test(l);

/**
 * A bare URL or TEC domain the model wrote in prose. Restricted on purpose: a greedy
 * URL matcher turns ordinary Arabic punctuation into broken links, so only an explicit
 * https:// or a known TEC host (`*.tecosystem.app`, `*.pi`) is linked.
 */
const AUTOLINK = /(https?:\/\/[^\s<>"']+|\b[a-z0-9-]+\.(?:tecosystem\.app|pi)\b)/gi;

/** Split one line into text / **bold** / `code` runs. */
/** Split plain prose into text and autolinked URLs. */
function linkify(text: string): RichToken[] {
  const out: RichToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  AUTOLINK.lastIndex = 0;

  while ((m = AUTOLINK.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    // Trailing sentence punctuation belongs to the sentence, not the URL.
    const raw  = m[0].replace(/[.,،؛:)\]]+$/, '');
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    out.push({ kind: 'link', value: raw, href });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

export function parseInline(line: string): RichToken[] {
  const tokens: RichToken[] = [];
  // Matches **bold** or `code`; anything else is prose (and may contain a URL).
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push(...linkify(line.slice(last, m.index)));
    if (m[1] !== undefined)      tokens.push({ kind: 'bold', value: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: 'code', value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) tokens.push(...linkify(line.slice(last)));
  return tokens;
}

/**
 * Split an answer into renderable blocks.
 *
 * Line-by-line for everything except tables, which are the one construct that spans
 * lines: a header row, a `|---|` rule, then data rows. Asking "what is app N?" produces
 * one routinely, and every pipe was reaching the user as literal text.
 */
export function parseRich(text: string): RichLine[] {
  const src: string[] = text.split('\n');
  const out: RichLine[] = [];

  for (let i = 0; i < src.length; i++) {
    const line = src[i].trimEnd();

    // ── table: a header row followed by a separator row ──
    if (isTableRow(line) && i + 1 < src.length && isTableRule(src[i + 1])) {
      const header = splitRow(line).map(parseInline);
      const rows: RichToken[][][] = [];
      i += 2;                                     // skip the header and its rule
      while (i < src.length && isTableRow(src[i])) {
        rows.push(splitRow(src[i]).map(parseInline));
        i++;
      }
      i--;                                        // the outer loop advances again
      out.push({ kind: 'table', header, rows });
      continue;
    }

    // A markdown rule (`---`) was reaching the screen as three literal dashes. Matched
    // BEFORE the bullet rule, which would otherwise claim it.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ kind: 'rule', tokens: [] }); continue; }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet)  { out.push({ kind: 'bullet', tokens: parseInline(bullet[1]) }); continue; }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) { out.push({ kind: 'heading', tokens: parseInline(heading[1]) }); continue; }
    out.push({ kind: 'text', tokens: parseInline(line) });
  }
  return out;
}
