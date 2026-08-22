'use client';
import { useState, useEffect, useCallback } from 'react';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { sessionToken } from '@/lib-client/pi/session-source';

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type KycLevel  = 'L0' | 'L1' | 'L2';

export interface KycRecord {
  id:               string;
  user_id:          string;
  status:           KycStatus;
  level:            KycLevel;
  id_front_url:     string | null;
  id_back_url:      string | null;
  selfie_url:       string | null;
  rejection_reason: string | null;
  verified_at:      string | null;
  submitted_at:     string | null;
  created_at:       string;
}

interface UseKycReturn {
  kyc:          KycRecord | null;
  isLoading:    boolean;
  isSubmitting: boolean;
  error:        string | null;
  refetch:      () => void;
  uploadDocs:   (data: { idFrontUrl?: string; idBackUrl?: string; selfieUrl?: string }) => Promise<void>;
  submit:       () => Promise<void>;
  reset:        () => void;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

// ✅ P1-1: cookie بدل localStorage
// ✅ P1-3: BFF /api/* بدل Gateway مباشرة
const makeHeaders = (): Record<string, string> => ({
  'Content-Type':  'application/json',
  Authorization:   `Bearer ${sessionToken() ?? ''}`,
  'x-csrf-token':  getCsrfToken(),
});

export function useKyc(): UseKycReturn {
  const [kyc,          setKyc]          = useState<KycRecord | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/kyc/status', {
        credentials: 'include',
        headers:     makeHeaders(),
      });
      if (!res.ok) throw new Error(`KYC fetch failed: ${res.status}`);
      const data = await res.json();
      setKyc(data.data.kyc);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadDocs = useCallback(async (data: {
    idFrontUrl?: string;
    idBackUrl?:  string;
    selfieUrl?:  string;
  }) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/kyc/upload', {
        method:      'POST',
        credentials: 'include',
        headers:     makeHeaders(),
        body:        JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message ?? 'Upload failed');
      }
      const result = await res.json();
      setKyc(result.data.kyc);
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/kyc/submit', {
        method:      'POST',
        credentials: 'include',
        headers:     makeHeaders(),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message ?? 'Submit failed');
      }
      const result = await res.json();
      setKyc(result.data.kyc);
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/kyc/start', {
        method:      'POST',
        credentials: 'include',
        headers:     makeHeaders(),
      });
      await fetchStatus();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchStatus]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return {
    kyc, isLoading, isSubmitting, error,
    refetch: fetchStatus,
    uploadDocs, submit, reset,
  };
}
