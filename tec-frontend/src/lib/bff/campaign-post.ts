/**
 * POST one Round 3 action to identity-service's campaign API.
 *
 * The owner is the verified token, read by the SERVICE — the body never names a
 * person. The service's own sentence is passed on, because it is the one a
 * pioneer can act on ("Open zone from this page and sign in there first").
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function campaignPost(
  path: 'pick' | 'report',
  body: unknown,
  token: string,
  requestId: string,
): Promise<unknown> {
  const res = await fetch(`${GATEWAY}/api/identity/campaign/${path}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
    body:  JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not save'), { status: res.status });
  }
  return data?.data ?? {};
}
