'use client';

/**
 * InstallPrompt (A3) — "Add TEC to your home screen".
 *
 * A retention win borrowed from strong Pi apps: an icon on the home screen
 * brings users back with one tap. Self-contained, no auth/payment.
 *
 * - Chromium/Android: captures `beforeinstallprompt` → native install button.
 * - iOS / Pi Browser (no event): shows the manual "Add to Home screen" steps.
 * - Already installed (standalone) or dismissed: renders nothing.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useInstallApp } from '@/lib-client/hooks/useInstallApp';

const DISMISS_KEY = 'tec_install_dismissed';

export default function InstallPrompt() {
  const { t, dir } = useTranslation();
  // Shared with the Dashboard menu entry — one place decides how installing works.
  const { isStandalone, hasNativePrompt, installUrl, install, copyLink } = useInstallApp();
  const [showSteps, setShowSteps] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); }
    catch { setDismissed(false); }
  }, []);

  if (isStandalone || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const onInstall = async () => {
    const needsSteps = await install();
    if (needsSteps) setShowSteps(true);
    else setDismissed(true);   // native prompt handled it
  };

  const onCopy = async () => {
    if (await copyLink()) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const i = t.home.install;
  const deferred = hasNativePrompt;

  return (
    <section dir={dir} style={{ width: '100%', maxWidth: 560, margin: '8px auto 0', padding: '0 16px', zIndex: 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          border: '1px solid rgba(var(--tec-gold-rgb),0.18)',
          background: 'rgba(var(--tec-gold-rgb),0.04)',
          borderRadius: 16,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>📲</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--tec-gold)', fontWeight: 600, fontSize: 14 }}>{i.cta}</div>
          <div style={{ color: 'rgba(232,224,208,0.5)', fontSize: 12, marginTop: 2 }}>{i.sub}</div>
        </div>
        <button
          onClick={onInstall}
          style={{
            flexShrink: 0,
            padding: '9px 16px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13,
            color: '#020205',
            background: 'var(--tec-gold)',
          }}
        >
          {deferred ? i.button : i.openInBrowser}
        </button>
        <button
          onClick={dismiss}
          aria-label={i.dismiss}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(232,224,208,0.12)',
            background: 'transparent',
            color: 'rgba(232,224,208,0.4)',
            cursor: 'pointer',
            fontSize: 15,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {showSteps && (
        <div
          style={{
            marginTop: 8,
            padding: '14px 18px',
            border: '1px solid rgba(var(--tec-gold-rgb),0.12)',
            background: 'rgba(2,2,5,0.5)',
            borderRadius: 14,
          }}
        >
          <div style={{ color: 'var(--tec-gold)', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            {i.stepsTitle}
          </div>
          {[i.step1, i.step2, i.step3].map((step, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'rgba(var(--tec-gold-rgb),0.14)',
                  color: 'var(--tec-gold)',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {idx + 1}
              </span>
              <span style={{ color: 'rgba(232,224,208,0.75)', fontSize: 13 }}>{step}</span>
            </div>
          ))}

          {/* The link + a copy button. Pi Browser cannot launch the phone's real
              browser, so pasting the URL there is the only step that works. */}
          <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(232,224,208,0.8)', wordBreak: 'break-all', userSelect: 'all', padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.35)' }}>
            {installUrl}
          </div>
          <button onClick={onCopy}
            style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(var(--tec-gold-rgb),0.3)', background: 'rgba(var(--tec-gold-rgb),0.1)', color: 'var(--tec-gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {copied ? i.copied : i.copyLink}
          </button>
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(232,224,208,0.45)', lineHeight: 1.6 }}>
            {i.whyBrowser}
          </div>
        </div>
      )}
    </section>
  );
}
