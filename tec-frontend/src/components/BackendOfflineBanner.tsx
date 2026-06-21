'use client';
import { usePlatformHealth } from '../context/PlatformHealthContext';

export function BackendOfflineBanner() {
  // Consumer of the single platform health runtime (C-96) — no own poller.
  const { online, isChecking, error, recheck } = usePlatformHealth();

  if (!online && !isChecking)
    return (
      <div
        role="alert"
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong style={{ color: '#dc2626' }}>⚠️ Backend Offline</strong>
          <p style={{ margin: '4px 0 0', color: '#991b1b', fontSize: '14px' }}>
            {error || 'Unable to reach the backend services. Some features may be unavailable.'}
          </p>
        </div>
        <button
          type="button"
          onClick={recheck}
          disabled={isChecking}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Retry
        </button>
      </div>
    );

  return null;
}
