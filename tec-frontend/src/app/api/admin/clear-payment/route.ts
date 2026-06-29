import { NextResponse } from 'next/server';

// ⚠️ TEMP one-off — يقفل دفعات Pi العالقة (developer_completed:false) عشان
// "Sign in with Pi" في الـ Hub يبطل يعلّق في loop. امسح الملف ده + redeploy بعد ما يشتغل.
// المفتاح ده مفتاح Pi بتاع تطبيق الـ Hub — هيتغيّر بعد التشغيل.
//
//   GET /api/admin/clear-payment            → يقفل كل الدفعات في PAYMENTS تحت
//   GET /api/admin/clear-payment?pid=..&txid=..  → يقفل دفعة واحدة بس (لو طلع pid جديد)

const PI_API_KEY = 'fwpaqoo47gzi42wkekwdyezrlhkefrkzl5jznfdww0qwurxp5nnifsmfypypmtne';

// الدفعات العالقة المعروفة. زوّد هنا لو طلع pid تاني وانت بتجرّب Sign in.
const PAYMENTS: { pid: string; txid: string }[] = [
  { pid: 'TG7uZCch44mt3Q6koqfQLnaYBLm0', txid: '50b46ec0c58a20160dbc2c64d783d30cc2d497a01949b3d472aaba5663da3486' },
  { pid: 'BgWyxcJfkmeuBLwcYR2ILwBZV4XT', txid: 'f08c2da6ce5950a62b56d8980cedf01eeba07b2de0bc94a1d23d0d795cc98bae' },
];

const AUTH = { Authorization: `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' };

async function clearOne(pid: string, txid: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { pid };

  // 1) اقرأ الحالة الحالية (يأكد إن المفتاح صح: status 200)
  try {
    const r = await fetch(`https://api.minepi.com/v2/payments/${pid}`, { headers: AUTH });
    out.before = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) {
    out.before = { error: String(e) };
  }

  // 2) اقفلها (complete) — الدفعة U2A متأكدة على الشبكة بس مش مكمّلة
  try {
    const r = await fetch(`https://api.minepi.com/v2/payments/${pid}/complete`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ txid }),
    });
    out.complete = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) {
    out.complete = { error: String(e) };
  }

  return out;
}

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const pid  = url.searchParams.get('pid');
  const txid = url.searchParams.get('txid');

  // وضع الدفعة الواحدة (لو بعتّ pid في الـ query)
  if (pid) {
    if (!txid) {
      // اقرأ الحالة بس عشان تجيب الـ txid الصح من transaction.txid
      const r = await fetch(`https://api.minepi.com/v2/payments/${pid}`, { headers: AUTH });
      return NextResponse.json({
        pid,
        before: { status: r.status, data: await r.json().catch(() => null) },
        note: 'هات transaction.txid من فوق وحطه في &txid= عشان أقفلها',
      });
    }
    return NextResponse.json(await clearOne(pid, txid));
  }

  // الوضع الافتراضي: اقفل كل الدفعات المعروفة
  const results = [];
  for (const p of PAYMENTS) {
    results.push(await clearOne(p.pid, p.txid));
  }
  return NextResponse.json({ success: true, count: results.length, results });
}
