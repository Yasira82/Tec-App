import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // بيكلم سيرفرات Pi مباشرة عشان يبعت أمر Complete للدفعة المعلقة
    const res = await fetch('https://api.minepi.com/v2/payments/inlCzuiyebprcSKYXp9iUbiKf6mW/complete', {
      method: 'POST',
      headers: {
        // الـ API Key بتاعك محطوط هنا جاهز
        'Authorization': 'Key ncwbzshjzlrubsdbsrp8v80r2munyhaby7xgctzdoinzz1niwqq8tuiw3ffuraqv',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        txid: 'b2043cc0d181e70227fac2bf1c865d327769810e6313c2a5ea3c305f9250c320'
      })
    });
    
    // لو Pi Network رجع خطأ، هنقرأه
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ 
        success: false, 
        message: 'Pi API returned an error', 
        status: res.status, 
        details: errorText 
      }, { status: res.status });
    }

    // لو نجح، هنقرأ النتيجة
    const data = await res.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Payment successfully completed on Pi Network!', 
      pi_response: data 
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to reach Pi Network API',
      error: String(error) 
    }, { status: 500 });
  }
}
