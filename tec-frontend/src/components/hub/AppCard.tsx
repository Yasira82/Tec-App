'use client';

import AppCard from './AppCard';

const APPS = [
  { name: 'Wallet',     emoji: '💳', href: '/dashboard/wallet',     status: 'live' as const },
  { name: 'Orders',     emoji: '📦', href: '/dashboard/orders',     status: 'live' as const },
  { name: 'KYC',        emoji: '🪪', href: '/dashboard/kyc',        status: 'live' as const },
  { name: 'AI',         emoji: '🤖', href: '/ai',                   status: 'live' as const },
  { name: 'Commerce',   emoji: '🛒', href: 'https://commerce.pi',   status: 'soon' as const },
  { name: 'Assets',     emoji: '💎', href: 'https://assets.pi',     status: 'soon' as const },
  { name: 'Fundx',      emoji: '📊', href: 'https://fundx.pi',      status: 'soon' as const },
  { name: 'Estate',     emoji: '🏠', href: 'https://estate.pi',     status: 'soon' as const },
  { name: 'Analytics',  emoji: '📈', href: 'https://analytics.pi',  status: 'soon' as const },
  { name: 'Connection', emoji: '🔗', href: 'https://connection.pi', status: 'soon' as const },
  { name: 'Insure',     emoji: '🛡️', href: 'https://insure.pi',     status: 'soon' as const },
  { name: 'Nexus',      emoji: '🌐', href: 'https://nexus.pi',      status: 'soon' as const },
];

export default function AppsGrid() {
  const liveCount = APPS.filter(a => a.status === 'live').length;

  return (
    <section className="px-4 mt-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Apps</h2>
        <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 rounded-full">
          {liveCount} Live
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {APPS.map(app => (
          <AppCard
            key={app.name}
            name={app.name}
            emoji={app.emoji}
            href={app.href}
            status={app.status}
          />
        ))}
      </div>
    </section>
  );
}
