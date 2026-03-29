import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id }     = await context.params;
  const authHeader = req.headers.get('authorization');
  try {
    const body = await req.json();
    const res  = await fetch(`${GATEWAY}/api/assets/marketplace/${id}/buy`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
