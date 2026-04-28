export interface HealthStatus {
  online:    boolean;
  status?:   string;
  services?: Record<string, { status: string; version?: string }>;
  error?:    string;
}

export async function checkBackendHealth(): Promise<HealthStatus> {
  try {
    // ✅ BFF — مش Gateway مباشرة
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { online: false, error: `Health check returned ${response.status}` };
    }

    const data = await response.json();
    return {
      online:   data.online ?? (data.status === 'ok' || data.status === 'degraded'),
      status:   data.status,
      services: data.services,
    };
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
