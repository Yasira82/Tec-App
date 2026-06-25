import { createHandler } from '@/lib/bff/createHandler';

const REALTIME_URL = process.env.REALTIME_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async () => {
    // Realtime is OPTIONAL (live wallet/notifications). If REALTIME_URL is not
    // configured, report it DISABLED (200) — never throw 500. A missing optional
    // feature must not spam error logs or trigger client reconnect loops (C-96, NEW-T).
    if (!REALTIME_URL) {
      return { enabled: false, url: null };
    }
    return { enabled: true, url: REALTIME_URL };
  },
});
