'use client';

import { useState, useCallback } from 'react';

const isDev = process.env.NODE_ENV !== 'production';

export interface DiagnosticEvent {
  timestamp: string;
  type:      'sdk_init' | 'auth' | 'approval' | 'completion' | 'error' | 'cancel';
  message:   string;
  data?:     unknown;
}

export const useDiagnostics = () => {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);

  const addEvent = useCallback((
    type:     DiagnosticEvent['type'],
    message:  string,
    data?:    unknown,
  ) => {
    const event: DiagnosticEvent = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };

    setEvents(prev => {
      const updated = [...prev, event];
      return updated.length > 100 ? updated.slice(-100) : updated;
    });

    if (isDev) {
      const icon =
        type === 'error'      ? '❌' :
        type === 'approval'   ? '✅' :
        type === 'completion' ? '✨' : '📋';
      console.log(`[Diagnostics ${icon}] ${message}`, data ?? '');
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, addEvent, clearEvents };
};
