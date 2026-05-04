'use client';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id:      string;
  type:    ToastType;
  message: string;
  txid?:   string;
}

export function ToastContainer({ toasts, onDismiss }: {
  toasts:    Toast[];
  onDismiss: (id: string) => void;
}) {
  const colors: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
    success: { bg: '#051a0a', border: '#7ee7c040', color: '#7ee7c0', icon: '✅' },
    error:   { bg: '#1a0505', border: '#e74c3c40', color: '#e74c3c', icon: '❌' },
    info:    { bg: '#0a0f1a', border: '#7eb8f740', color: '#7eb8f7', icon: 'ℹ️' },
    warning: { bg: '#1a1505', border: '#f0c04040', color: '#f0c040', icon: '⚠️' },
  };
  return (
    <div style={{ position: 'fixed', top: 70, left: 16, right: 16, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(toast => {
        const c = colors[toast.type];
        return (
          <div key={toast.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <span style={{ fontSize: 16 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{toast.message}</div>
              {toast.txid && (
                <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'monospace', marginTop: 3 }}>
                  txid: {toast.txid.slice(0, 20)}...
                </div>
              )}
            </div>
            <button onClick={() => onDismiss(toast.id)} style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
