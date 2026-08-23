'use client';

import { useEffect, useState } from 'react';
import { Icon }                from '@/components/ui/Icon';
import { useTranslation }      from '@/lib/i18n';
import {
  readTheme, saveTheme, resolvedTheme, THEME_ORDER, type ThemeChoice,
} from '@/lib-client/theme';

/**
 * One button, three states: system → light → dark → system.
 *
 * A switch would only offer two and force a choice; "system" is the honest
 * default and the one most people want, so it stays reachable rather than
 * being something you lose the moment you touch the control.
 *
 * The icon shows what you will GET, and the label names it, so a single
 * glyph never has to carry the whole meaning on its own.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  // Always start on the SSR value; the real choice lands in the effect. Reading
  // localStorage during render would give the server and the client different
  // markup and React would discard the first paint.
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [ready,  setReady]  = useState(false);

  useEffect(() => { setChoice(readTheme()); setReady(true); }, []);

  const next = () => {
    const c = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]!;
    setChoice(c);
    saveTheme(c);
  };

  const label = t.common.theme[choice];
  // Before hydration the stored choice is unknown; show the neutral "system"
  // glyph rather than guessing and flipping.
  const glyph = !ready || choice === 'system' ? 'settings'
              : resolvedTheme(choice) === 'light' ? 'sun' : 'moon';

  return (
    <button
      onClick={next}
      aria-label={`${t.common.theme.label} — ${label}`}
      title={`${t.common.theme.label} — ${label}`}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 0 : 7,
        width: compact ? 36 : undefined, height: 36,
        justifyContent: 'center', padding: compact ? 0 : '0 12px',
        borderRadius: 10, cursor: 'pointer', flexShrink: 0,
        background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
        color: 'var(--tec-text-2)', fontSize: 12, fontWeight: 600,
        fontFamily: 'inherit',
      }}>
      <Icon name={glyph} size={17} color="var(--tec-text-2)" strokeWidth={1.9} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
