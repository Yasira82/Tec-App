const GATEWAY_URL = process.env.API_GATEWAY_URL ?? '';

export async function checkGatewayHealth(): Promise<{ online: boolean; services?: object }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${GATEWAY_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { online: false };
    const data = await res.json().catch((err: unknown) => {
      console.warn('[BackendStatus] Failed to parse health response:', err);
      return {};
    });
    return { online: true, services: data.services ?? data };
  } catch {
    return { online: false };
  }
}
