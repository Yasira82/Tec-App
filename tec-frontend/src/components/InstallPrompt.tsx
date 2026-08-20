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

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'tec_install_dismissed';

export default function InstallPrompt() {
  const { t, dir } = useTranslation();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already installed → never show.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => setHidden(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  };

  const onInstall = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch { /* user closed the native prompt */ }
      setDeferred(null);
      setHidden(true);
      return;
    }
    // Pi Browser is an in-app webview with NO "Add to Home screen" — the icon can
    // only be added from the phone's real browser. So open this URL there, then
    // show the (corrected) steps. Same approach as other strong Pi apps.
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    } catch { /* ignore */ }
    setShowSteps(true);
  };

  const i = t.home.install;

  return (
    <section dir={dir} style={{ width: '100%', maxWidth: 560, margin: '8px auto 0', padding: '0 16px', zIndex: 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          border: '1px solid rgba(251,191,36,0.18)',
          background: 'rgba(251,191,36,0.04)',
          borderRadius: 16,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>📲</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#FBBF24', fontWeight: 600, fontSize: 14 }}>{i.cta}</div>
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
            background: 'linear-gradient(135deg, #f5d060 0%, #FBBF24 45%, #d4af37 100%)',
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
            border: '1px solid rgba(251,191,36,0.12)',
            background: 'rgba(2,2,5,0.5)',
            borderRadius: 14,
          }}
        >
          <div style={{ color: '#FBBF24', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
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
                  background: 'rgba(251,191,36,0.14)',
                  color: '#FBBF24',
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
        </div>
      )}
    </section>
  );
}
