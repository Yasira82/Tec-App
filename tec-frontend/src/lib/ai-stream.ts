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
        const parsed = JSON.parse(data) as { text?: unknown; truncated?: unknown };
        if (typeof parsed.text === 'string') text += parsed.text;
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
  | { kind: 'code'; value: string };

export interface RichLine {
  kind:   'text' | 'bullet' | 'heading';
  tokens: RichToken[];
}

/** Split one line into text / **bold** / `code` runs. */
export function parseInline(line: string): RichToken[] {
  const tokens: RichToken[] = [];
  // Matches **bold** or `code`; anything else is literal text.
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', value: line.slice(last, m.index) });
    if (m[1] !== undefined)      tokens.push({ kind: 'bold', value: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: 'code', value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) tokens.push({ kind: 'text', value: line.slice(last) });
  return tokens;
}

/** Split an answer into renderable lines, classifying bullets and headings. */
export function parseRich(text: string): RichLine[] {
  return text.split('\n').map((raw) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) return { kind: 'bullet' as const, tokens: parseInline(bullet[1]) };
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) return { kind: 'heading' as const, tokens: parseInline(heading[1]) };
    return { kind: 'text' as const, tokens: parseInline(line) };
  });
}
