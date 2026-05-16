'use client';

import { useEffect, useState }    from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePiAuth }              from '@/lib-client/hooks/usePiAuth';
import { Sidebar }                from '@/components/dashboard/Sidebar';
import { MobileTopbar }           from '@/components/dashboard/MobileTopbar';
import '@/styles/tec-design-tokens.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = usePiAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const [isDesktop,  setIsDesktop]  = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media  = window.matchMedia('(min-width: 1024px)');
    const handle = () => setIsDesktop(media.matches);
    handle();
    media.addEventListener('change', handle);
    return () => media.removeEventListener('change', handle);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    document.body.style.overflow = (!isDesktop && mobileOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen, isDesktop]);

  const handleLogout = () => { logout(); router.push('/'); };

  if (isDesktop === null || isLoading || !user) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--tec-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="tec-spin" style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(212,175,55,0.15)',
          borderTopColor: 'var(--tec-gold)',
        }} />
      </div>
    );
  }

  const showOverlay = !isDesktop && mobileOpen;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--tec-bg)',
      color: 'var(--tec-text-1)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
    }}>

      {/* ── Mobile overlay ─────────────────────────── */}
      {showOverlay && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 200,
            background: 'rgba(2,2,5,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      {/* ── Sidebar ────────────────────────────────── */}
      <div
        id="tec-sidebar"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          zIndex: 210,
          transform: (isDesktop || mobileOpen) ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          width: 240,
        }}>
        <Sidebar
          user={user as { piUsername?: string; subscriptionPlan?: string; kycVerified?: boolean }}
          onLogout={handleLogout}
        />
      </div>

      {/* ── Mobile Top Bar ─────────────────────────── */}
      {!isDesktop && (
        <MobileTopbar
          mobileOpen={mobileOpen}
          onToggle={() => setMobileOpen(p => !p)}
        />
      )}

      {/* ── Main Content ───────────────────────────── */}
      <main
        className="tec-main-content"
        style={{
          flex: 1,
          marginLeft:  isDesktop ? 240 : 0,
          marginTop:   isDesktop ? 0   : 64,
          padding:     'var(--sp-6) var(--sp-5)',
          minHeight:   '100vh',
          transition:  'margin-left 0.3s ease, margin-top 0.3s ease',
        }}>
        {children}
      </main>
    </div>
  );
}
