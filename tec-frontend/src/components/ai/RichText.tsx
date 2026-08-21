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
        line.kind === 'rule' ? (
          <hr key={i} style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.10)', margin: '10px 0' }} />
        ) :
        // dir="auto" per LINE, not per bubble: the browser picks direction from the
        // first strong character, so an Arabic sentence containing "Pi" or "NX" keeps
        // its punctuation at the correct end. Without it, an Arabic reply rendered in an
        // LTR container puts the full stop at the START of the line.
        <div key={i} dir="auto" style={{
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
              : tok.kind === 'link' ? (
                // A bare domain the model wrote in prose ("epic.tecosystem.app") was
                // plain text the user had to retype. Opened in a new tab so the
                // conversation is not lost behind the navigation.
                <a key={j} href={tok.href} target="_blank" rel="noopener noreferrer"
                   style={{ color: '#FBBF24', textDecoration: 'underline', wordBreak: 'break-all' }}>
                  {tok.value}
                </a>
              )
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
