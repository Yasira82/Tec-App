'use client';

import { useRouter }      from 'next/navigation';
import { Icon }           from '@/components/ui/Icon';
import { useTranslation } from '@/lib/i18n';
import { haptic }         from '@/lib/hub/utils';

/**
 * Platform Tools — the scroll-away shortcut row under the apps grid.
 *
 * It holds ONLY what the fixed bottom nav does not. The row used to repeat
 * Verify and Plan, both of which are one thumb-reach away in the nav that is
 * always on screen: the same destination offered twice, in two different
 * shapes, reads as two different places. What is left is the pair that has no
 * permanent home — platform metrics and the invite loop.
 */
export function HubTools() {
  const router  = useRouter();
  const { t }   = useTranslation();

  const tools = [
    { icon: 'chart' as const, label: t.hub.tools.analytics, route: '/hub/analytics' },
    { icon: 'plus'  as const, label: t.hub.tools.invite,    route: '/hub/referral'  },
  ];

  return (
    <div style={{ margin: '0 16px 8px', display: 'flex', gap: 8 }}>
      {tools.map(({ icon, label, route }) => (
        <button
          key={route}
          onClick={() => { haptic('light'); router.push(route); }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 0', borderRadius: 14,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--tec-border)',
            color: 'var(--tec-text-2)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 0.4,
          }}
        >
          <Icon name={icon} size={15} color="var(--tec-text-2)" strokeWidth={1.9} />
          {label}
        </button>
      ))}
    </div>
  );
}
