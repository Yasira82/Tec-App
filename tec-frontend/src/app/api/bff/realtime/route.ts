import { createHandler } from '@/lib/bff/createHandler';

const REALTIME_URL = process.env.REALTIME_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async () => {
    if (!REALTIME_URL) {
      throw new Error('REALTIME_URL not configured');
    }
    return { url: REALTIME_URL };
  },
});
