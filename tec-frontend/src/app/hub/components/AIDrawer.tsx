'use client';

import { useState, useCallback } from 'react';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

export function AIDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading,  setLoading]  = useState(false);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
      });
      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try { const parsed = JSON.parse(data); if (parsed.text) reply += parsed.text; } catch { /* skip */ }
          }
        }
      }
      setMessages(prev => [...prev, { role: 'ai', text: reply || 'Sorry, no response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Connection error. Try again.' }]);
    } finally { setLoading(false); }
  }, [input, loading]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#0B1020', borderTop: '1px solid #FBBF2420', borderRadius: '24px 24px 0 0', padding: '0 0 32px', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff20' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>TEC AI</div>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>Powered by tec.pi</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#4a4a5a', fontSize: 13 }}>مرحباً! أنا مساعدك الذكي على TEC 🤖</div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: m.role === 'user' ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#0d0d1a',
                border: m.role === 'ai' ? '1px solid #ffffff08' : 'none',
                fontSize: 13, color: m.role === 'user' ? '#0a0800' : '#fff', lineHeight: 1.5,
              }}>{m.text}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24', animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="اسأل TEC AI..."
            style={{ flex: 1, background: '#0B1020', border: '1px solid #ffffff10', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 13, outline: 'none' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#ffffff08', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>↑</button>
        </div>
      </div>
    </>
  );
}
