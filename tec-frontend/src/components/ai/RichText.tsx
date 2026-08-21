'use client';

import { parseRich } from '@/lib/ai-stream';

/**
 * Renders an assistant reply's light markdown — `**bold**`, `` `code` ``, bullets and
 * headings — instead of printing the markers.
 *
 * Shared by BOTH assistant surfaces (the Hub drawer and the /ai page) on purpose: they
 * are two separate components talking to the same route, and every fix applied to one
 * of them has so far had to be re-discovered on the other. One renderer, one behaviour.
 *
 * Inline styles only (Pi Browser), and the text is tokenised — never interpreted as
 * HTML — so a reply can never inject markup.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = parseRich(text);
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display:    line.kind === 'bullet' ? 'flex' : 'block',
          gap:        line.kind === 'bullet' ? 6 : undefined,
          fontWeight: line.kind === 'heading' ? 700 : undefined,
          marginTop:  line.kind === 'heading' && i > 0 ? 6 : undefined,
          minHeight:  line.tokens.length === 0 ? 6 : undefined,
        }}>
          {line.kind === 'bullet' && <span style={{ opacity: 0.6 }}>•</span>}
          <span>
            {line.tokens.map((tok, j) =>
              tok.kind === 'bold' ? <strong key={j}>{tok.value}</strong>
              : tok.kind === 'code' ? (
                <code key={j} style={{
                  background: 'rgba(255,255,255,0.08)', borderRadius: 4,
                  padding: '1px 4px', fontSize: '0.92em',
                }}>{tok.value}</code>
              ) : <span key={j}>{tok.value}</span>,
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
