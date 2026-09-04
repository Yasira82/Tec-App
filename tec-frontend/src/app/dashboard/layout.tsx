'use client';

import { useEffect, useState }    from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePiAuth }              from '@/lib-client/hooks/usePiAuth';
import { rememberReturn }         from '@/lib-client/return-to';
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
    if (!isLoading && !isAuthenticated) {
      // Remember the screen before leaving it. This used to be a bare
      // `router.push('/')`, which is right about the destination and wrong
      // about everything else: the person signs in again and lands on the
      // marketing page, then has to find their way back to where they already
      // were. `replace`, not `push`, so Back does not return to a page that
      // will immediately bounce them again.
      rememberReturn(pathname);
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router, pathname]);

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
          border: '3px solid rgba(var(--tec-gold-rgb),0.15)',
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
            background: 'var(--tec-bg)',
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

      {/* ── Topbar + content ───────────────────────────
          One COLUMN inside the row. The topbar used to be `fixed`, which kept
          it out of the flow entirely — so it painted over the "open in Pi
          Browser" banner, and the content underneath needed a hand-tuned
          offset to clear it. Sticky fixes both, but only from inside a column:
          as a direct child of the row it became a flex sibling of <main> and
          ate a third of the viewport width. */}
      <div style={{
        flex: 1,
        // Without this a wide child (a table, a long balance) refuses to
        // shrink below its content and pushes the column past the viewport.
        minWidth: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        {!isDesktop && (
          <MobileTopbar
            mobileOpen={mobileOpen}
            onToggle={() => setMobileOpen(p => !p)}
          />
        )}

        <main
          className="tec-main-content"
          style={{
            flex: 1,
            marginLeft: isDesktop ? 240 : 0,
            transition: 'margin-left 0.3s ease',
          }}>
          {children}
        </main>
      </div>
    </div>
  );
} 
