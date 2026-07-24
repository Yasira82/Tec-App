'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                                 from 'next/navigation';
import { usePiAuth }                                 from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                             from '@/lib-client/hooks/usePiSdkReady';
import { piSession }                                 from '@/lib-client/pi/pi-session';
import { useRealtimeNotifications }                  from '@/lib-client/hooks/useRealtimeNotifications';
import { getAccessToken, getStoredUser }             from '@/lib-client/pi/pi-auth';
import { tecSession }                                from '@/lib-client/pi/tec-session';
import { LIVE_DOMAINS }                              from '@/domains/_registry';
import { ErrorBoundary }                             from '@/components/ErrorBoundary';
import { ToastContainer, Toast }                     from './components/ToastContainer';
import { AIDrawer }                                  from './components/AIDrawer';
import { Icon }                                       from '@/components/ui/Icon';
import { HubSkeleton }                               from './components/HubSkeleton';
import { PaymentModal, ExternalPayment }             from './components/PaymentModal';
import {
  HubHeader, HubWalletCard, HubCarousel,
  HubAppsGrid, HubComingSoon,
} from '@/components/hub';
import { useHubData }  from '@/hooks/useHubData';
import { haptic }      from '@/lib/hub/utils';
import '@/styles/tec-design-tokens.css';

const ASSETS_URL     = 'https://assets.tecosystem.app';
const COMMERCE_URL   = 'https://commerce.tecosystem.app';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

function HubPageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();

  // Fire-and-forget backend warmup (Railway cold starts — see /api/warmup):
  // wake the gateway while auth resolves so wallet/apps data lands warm.
  useEffect(() => { fetch('/api/warmup').catch(() => {}); }, []);
  const { piReady } = usePiSdkReady();
  const router = useRouter();

  // LIVE NOW shows every live app: visibility is not authorization — KYC/role
  // gating stays enforced by each app and its services (P6). Filtering live
  // apps by the KYC flag made Assets/Commerce invisible to non-KYC users.
  // External apps are entered through Hub SSO so they land with a session.
  const visibleLive = LIVE_DOMAINS
    .filter(d => d.layer !== 'os')
    .map(d => {
      const route = d.route ?? `/${d.slug}`;
      const href  = route.startsWith('http')
        ? `/api/auth/sso?target=${encodeURIComponent(route)}`
        : route;
      return { slug: d.slug, name: d.name.en, emoji: d.emoji, href, desc: d.description.en, group: d.group };
    });

  const { balance, assetCount, piPrice, notifCount, time, setNotifCount, refreshBalance } =
    useHubData(user?.id);

  const [carouselIdx,     setCarouselIdx]     = useState(0);
  const [aiOpen,          setAiOpen]          = useState(false);
  const [toasts,          setToasts]          = useState<Toast[]>([]);
  const [externalPayment, setExternalPayment] = useState<ExternalPayment | null>(null);
  const [pendingPayment,  setPendingPayment]  = useState<Omit<ExternalPayment, 'internalId'> | null>(null);

  const showToast = useCallback((type: Toast['type'], message: string, txid?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, txid }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  /* ── Step 1: قرا الـ URL params فوراً ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('pay') === '1') {
      const amount = parseFloat(p.get('amount') ?? '0');
      if (amount > 0) {
        setPendingPayment({
          amount,
          memo:      decodeURIComponent(p.get('memo')       ?? 'TEC Payment'),
          productId: p.get('product_id') ?? '',
          // No return_url (template apps like Nexus/Zone don't send one) → come
          // back to the Hub, NOT Commerce. The old COMMERCE_URL default dumped
          // every template-app Mode-1 payment onto Commerce after "Close".
          returnUrl: decodeURIComponent(p.get('return_url') ?? `${window.location.origin}/hub`),
          source:    p.get('source')     ?? 'hub',
        });
        window.history.replaceState({}, '', '/hub');
      }
    }
  }, []);

  /* ── Step 2: piReady + authReady → create record → show Modal ── */
  useEffect(() => {
    if (!(piReady && pendingPayment && !externalPayment)) return;
    // C-123 §7: wait for auth resolution to settle. This (a) serializes the
    // silent re-auth's Pi.authenticate against the PaymentModal's — Pi Browser
    // breaks on concurrent authenticate calls — and (b) makes the in-memory
    // session available in cookie-refusing contexts, where the old cookie-only
    // read left this flow stuck on "Preparing payment…" forever.
    if (isLoading) return;
    let cancelled = false;

    (async () => {
      const storedUser = user ?? tecSession.user ?? getStoredUser();
      const userId = (storedUser as { id?: string; piId?: string } | null)?.id
                  ?? (storedUser as { id?: string; piId?: string } | null)?.piId;
      if (!userId) return;

      try {
        const res = await fetch('/api/payment/create', {
          method:      'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${tecSession.token ?? getAccessToken()}`,
            'x-csrf-token': getCsrfToken(),
          },
          body: JSON.stringify({
            // ✅ amount = number — يطابق tec-payment-service (DECIMAL/number) والتطبيقات الـ3.
            // String() كان بيخلي الـ payment-service يرفض → internalId=null → modal flash.
            amount:         pendingPayment.amount,
            currency:       'PI',
            payment_method: 'pi',
            source:         'hub',
            metadata: {
              app_source: pendingPayment.source,
              product_id: pendingPayment.productId,
            },
          }),
        });

        const data       = await res.json().catch(() => ({}));
        const internalId = data?.data?.payment?.id ?? data?.data?.id ?? data?.data?.payment_id ?? null;

        if (cancelled) return;

        if (!internalId) {
          const ret = new URL(pendingPayment.returnUrl);
          ret.searchParams.set('payment_status', 'error');
          ret.searchParams.set('reason', 'create_failed');
          window.location.href = ret.toString();
          return;
        }

        setExternalPayment({ ...pendingPayment, internalId });
        setPendingPayment(null);
      } catch {
        if (cancelled) return;
        showToast('error', 'Failed to initialize payment. Please try again.');
        const ret = new URL(pendingPayment.returnUrl);
        ret.searchParams.set('payment_status', 'error');
        ret.searchParams.set('reason', 'create_failed');
        window.location.href = ret.toString();
      }
    })();

    return () => { cancelled = true; };
  }, [piReady, pendingPayment, externalPayment, showToast, isLoading, user]);

  const handlePaymentSuccess = useCallback(async (txid: string, paymentId: string) => {
  if (!externalPayment) return;
  setExternalPayment(null);
  const ret = new URL(externalPayment.returnUrl);
  ret.searchParams.set('payment_status', 'success');
  ret.searchParams.set('txid',           txid);
  ret.searchParams.set('payment_id',     paymentId);
  ret.searchParams.set('product_id',     externalPayment.productId);
  window.location.href = ret.toString();
}, [externalPayment]);

  useEffect(() => {
    if (!piPrice) return;
    const id = setInterval(() => setCarouselIdx(p => p === 2 ? 0 : p + 1), 5000);
    return () => clearInterval(id);
  }, [piPrice]);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !pendingPayment) router.replace('/');
  }, [isLoading, isAuthenticated, pendingPayment, router]);

  const { unread: wsUnread, clearUnread } = useRealtimeNotifications({
    userId: user?.id, token: getAccessToken(),
    onWalletUpdate: () => setTimeout(refreshBalance, 500),
  });

  /* ── Early returns ── */
  if (isLoading || (!isAuthenticated && !pendingPayment)) return <HubSkeleton />;

  // ✅ لو في pending Commerce payment → اعرض loading بس (مش Hub كامل)
  if (isAuthenticated && pendingPayment && !externalPayment) {
    return (
      <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#0a0800' }}>T</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.2)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#4a4a5a' }}>Preparing payment...</span>
        </div>
      </div>
    );
  }

  // ✅ مش authenticated بس في pending payment (SSO لسه شغال)
  if (!isAuthenticated && pendingPayment) {
    return (
      <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#0a0800' }}>T</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.2)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#4a4a5a' }}>Preparing payment...</span>
        </div>
        {externalPayment && (
          <PaymentModal
            payment={externalPayment}
            onClose={() => { setExternalPayment(null); window.location.href = externalPayment.returnUrl; }}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    );
  }

  const totalNotif   = wsUnread > 0 ? wsUnread : notifCount;
  const goToAssets    = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(ASSETS_URL); };
  const goToCommerce  = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(COMMERCE_URL); };
  // Marketing missions entry — the Pioneer Quest / Founding 100 (public route, same origin).
  const goToPioneers  = () => { haptic('light'); router.push('/pioneers'); };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div
      style={{ minHeight: '100vh', background: '#050816', color: '#fff', fontFamily: 'var(--font-sans)', paddingBottom: 88 }}
    >
      {/* ✅ PaymentModal لما يكون externalPayment موجود */}
      {externalPayment && (
        <PaymentModal
          payment={externalPayment}
          onClose={() => { setExternalPayment(null); window.location.href = externalPayment.returnUrl; }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      {!aiOpen && (
        <button className="tec-float tec-btn" onClick={() => { haptic('medium'); setAiOpen(true); }}
          aria-label="Open AI assistant"
          style={{ position: 'fixed', bottom: 100, right: 16, zIndex: 200, width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', boxShadow: '0 8px 24px rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="sparkles" size={24} color="#050816" strokeWidth={2.2} /></button>
      )}

      <HubHeader
        piUsername={user?.piUsername ?? ''}
        time={time}
        notifCount={totalNotif}
        onNotifClick={() => { haptic('light'); clearUnread(); setNotifCount(0); router.push('/hub/notifications'); }}
      />
      {/* Personalized greeting — time-of-day + Pi username */}
      {user?.piUsername && (
        <div style={{ padding: '16px 20px 0', animation: 'tec-fade-in 0.35s ease both' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>
            {greeting}, <span style={{ color: '#FBBF24' }}>@{user.piUsername}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>Your Pi economy, all in one place.</div>
        </div>
      )}

      <HubWalletCard balance={balance} piPrice={piPrice} />

      {/* Carousel = the top spotlight: Founding-100 marketing missions + an app
          announcement + the live Pi price. (Assets/Commerce/Analytics slides removed.) */}
      <HubCarousel
        carouselIdx={carouselIdx}
        setCarouselIdx={setCarouselIdx}
        piPrice={piPrice}
        goToPioneers={goToPioneers}
      />

      <HubAppsGrid apps={visibleLive} />

      {/* ✅ HubPayActions محذوف — π Pay / π Receive كانوا for testing بس */}

      {/* ── Platform Tools ──────────────────────────────── */}
      <div style={{ margin: '0 16px 8px', display: 'flex', gap: 8 }}>
        {[
          { icon: '📊', label: 'Analytics', route: '/hub/analytics' },
          { icon: '🪪', label: 'KYC',        route: '/hub/kyc' },
          { icon: '⭐', label: 'Plan',        route: '/hub/subscription' },
        ].map(({ icon, label, route }) => (
          <button
            key={label}
            onClick={() => { haptic('light'); router.push(route); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', letterSpacing: 0.4,
            }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <HubComingSoon />

      <nav aria-label="Main navigation" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(5,5,10,0.92)', backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', padding: '10px 4px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', zIndex: 150 }}>
        {([
          { icon: 'hub'      as const, label: 'Hub',      active: true,  action: () => {} },
          { icon: 'wallet'   as const, label: 'Wallet',   active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
          { icon: 'gem'      as const, label: 'Assets',   active: false, action: goToAssets },
          { icon: 'cart'     as const, label: 'Commerce', active: false, action: goToCommerce },
          { icon: 'settings' as const, label: 'Settings', active: false, action: () => { haptic('light'); router.push('/hub/profile'); } },
        ]).map(item => (
          <button key={item.label} className="tec-nav-btn" onClick={item.action} aria-label={item.label} aria-current={item.active ? 'page' : undefined}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
            {item.active && <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, borderRadius: 999, background: 'linear-gradient(90deg,#FBBF24,#F59E0B)', boxShadow: '0 0 8px rgba(251,191,36,0.6)' }} />}
            <Icon name={item.icon} size={21} color={item.active ? '#FBBF24' : 'rgba(255,255,255,0.4)'} strokeWidth={item.active ? 2.2 : 1.9} />
            <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400, color: item.active ? '#FBBF24' : 'rgba(255,255,255,0.28)' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function HubPage() {
  return <ErrorBoundary><HubPageInner /></ErrorBoundary>;
      }
