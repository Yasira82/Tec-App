'use client';

import { useEffect, useRef } from 'react';
import { usePiAuth }                       from '@/lib-client/hooks/usePiAuth';
import { getPendingRef, clearPendingRef, applyReferral } from '@/lib-client/referral';

/**
 * Render-nothing applier. Once the visitor is authenticated (anywhere in the
 * Hub), if a referral code was captured earlier from an invite link, apply it to
 * their account and clear it. This closes the loop for someone who opened an
 * invite link on the public landing page and only logged in later — the reward
 * is attributed without them ever visiting /hub/referral.
 */
export function RefApply() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || ran.current) return;
    const code = getPendingRef();
    if (!code) return;
    ran.current = true; // one attempt per mount; never loop
    applyReferral(code).then(result => {
      // 'applied' or 'consumed' → done; 'retry' → keep for a later session.
      if (result !== 'retry') clearPendingRef();
    });
  }, [isAuthenticated, isLoading]);

  return null;
}
