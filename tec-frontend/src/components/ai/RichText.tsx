'use client';

import { parseRich, type RichToken } from '@/lib/ai-stream';

/**
 * Renders an assistant reply's light markdown — `**bold**`, `` `code` ``, bullets,
 * headings, rules, links and tables — instead of printing the markers.
 *
 * Shared by BOTH assistant surfaces (the Hub drawer and the /ai page) on purpose: they
 * are two separate components talking to the same route, and every fix applied to one
 * of them has so far had to be re-discovered on the other. One renderer, one behaviour.
 *
 * Inline styles only (Pi Browser), and the text is tokenised — never interpreted as
 * HTML — so a reply can never inject markup.
 */

function Tokens({ tokens }: { tokens: RichToken[] }) {
  return (
    <>
      {tokens.map((tok, j) =>
        tok.kind === 'bold' ? <strong key={j}>{tok.value}</strong>
        : tok.kind === 'link' ? (
          // A bare domain the model wrote in prose ("epic.tecosystem.app") was plain
          // text the user had to retype. Opened in a new tab so the conversation is not
          // lost behind the navigation.
          // `break-all` only in prose, where a long URL must not overflow the bubble.
          // Inside a table cell `white-space: nowrap` wins and the link stays intact.
          <a key={j} href={tok.href} target="_blank" rel="noopener noreferrer"
             style={{ color: '#FBBF24', textDecoration: 'underline', overflowWrap: 'anywhere' }}>
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
    </>
  );
}

const cell: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  verticalAlign: 'top',
  textAlign: 'start',
  // The table already scrolls horizontally, so a cell has no reason to wrap — and
  // wrapping is what shredded a domain into "hub.tec / osyste / m.app" and split
  // "Commerce" across two lines. Columns stay readable; the row scrolls instead.
  whiteSpace: 'nowrap',
};

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = parseRich(text);
  return (
    <div className={className}>
      {lines.map((line, i) => {
        if (line.kind === 'rule') {
          return <hr key={i} style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.10)', margin: '10px 0' }} />;
        }

        if (line.kind === 'table') {
          // A four-column table cannot fit a phone. It scrolls INSIDE its own container
          // rather than widening the bubble — the alternative was the raw `| a | b |`
          // pipes the user actually saw, which are not readable at any width.
          return (
            <div key={i} dir="auto" style={{ overflowX: 'auto', margin: '8px 0', maxWidth: '100%' }}>
              {/* No minWidth: the table takes the width its content needs and the
                  wrapper scrolls. Forcing it to the container width is what squeezed
                  the columns into unreadable slivers. */}
              <table style={{ borderCollapse: 'collapse', fontSize: '0.92em' }}>
                <thead>
                  <tr>
                    {line.header.map((cellTokens, h) => (
                      <th key={h} style={{ ...cell, fontWeight: 700, whiteSpace: 'nowrap', opacity: 0.85 }}>
                        <Tokens tokens={cellTokens} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {line.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cellTokens, c) => (
                        <td key={c} style={cell}><Tokens tokens={cellTokens} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
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
            <span><Tokens tokens={line.tokens} /></span>
          </div>
        );
      })}
    </div>
  );
}
