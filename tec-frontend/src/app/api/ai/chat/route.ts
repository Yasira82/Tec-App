import { NextRequest, NextResponse } from 'next/server';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';

export const runtime = 'edge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Rate Limiter ──────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT   = 20;
const RATE_WINDOW  = 60_000;

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
  }
  return true;
}

// ── CORS ──────────────────────────────────────────────────
function getCorsHeaders(req: NextRequest) {
  const origin    = req.headers.get('origin') || '';
  const isAllowed = origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin':  isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

const buildSystemPrompt = (userContext?: {
  username?: string;
  balance?:  number;
  locale?:   string;
}) => `${TEC_SYSTEM_PROMPT}

## CURRENT USER CONTEXT
${userContext?.username ? `- Username: @${userContext.username}` : '- User: Guest'}
${userContext?.balance !== undefined ? `- TEC Balance: ${userContext.balance.toFixed(2)} TEC` : ''}
${userContext?.locale ? `- Language preference: ${userContext.locale === 'ar' ? 'Arabic' : 'English'}` : ''}
`;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status:  204,
    headers: getCorsHeaders(req),
  });
}

// ── 1️⃣ Claude ────────────────────────────────────────────
const callClaude = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
): Promise<Response> => {
  return fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
      stream:     true,
    }),
  });
};

// ── 2️⃣ Groq ──────────────────────────────────────────────
const callGroq = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
): Promise<Response> => {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages:   [{ role: 'system', content: systemPrompt }, ...messages],
      stream:     true,
    }),
  });
};

// ── 3️⃣ Gemini ────────────────────────────────────────────
const callGemini = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
): Promise<Response> => {
  const geminiMessages = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents:           geminiMessages,
        generationConfig:   { maxOutputTokens: 1024 },
      }),
    },
  );
};

// ── Unified Stream Transform ──────────────────────────────
function createUnifiedStream(provider: string) {
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]' || !dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          let text = '';

          if (provider === 'claude') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              text = parsed.delta.text;
            }
          } else if (provider === 'groq') {
            if (parsed.choices?.[0]?.delta?.content) {
              text = parsed.choices[0].delta.content;
            }
          } else if (provider === 'gemini') {
            if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
              text = parsed.candidates[0].content.parts[0].text;
            }
          }

          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
            );
          }
        } catch {
          // Ignore incomplete JSON — expected in SSE streams
        }
      }
    },
    flush() {
      buffer += decoder.decode(new Uint8Array(), { stream: false });
    },
  });
}

// ── Main POST Handler ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  // ✅ P0-3: Rate limiting — 20 req/min per IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.' },
      { status: 429, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();

const messages: Message[] = body.messages
  ?? [{ role: 'user' as const, content: body.message ?? '' }];

const userContext: { username?: string; balance?: number; locale?: string } | undefined
  = body.userContext;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const systemPrompt = buildSystemPrompt(userContext);
    const claudeKey    = process.env.ANTHROPIC_API_KEY;
    const groqKey      = process.env.GROQ_API_KEY;
    const geminiKey    = process.env.GEMINI_API_KEY;

    if (!claudeKey && !groqKey && !geminiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503, headers: corsHeaders },
      );
    }

    let response: Response | null = null;
    let provider = '';

    // 1️⃣ Claude
    if (claudeKey && !response) {
      try {
        const res = await callClaude(messages, systemPrompt, claudeKey);
        if (res.ok) { response = res; provider = 'claude'; }
        else { console.warn('Claude failed:', res.status); }
      } catch (e) {
        console.warn('Claude error:', (e as Error).message);
      }
    }

    // 2️⃣ Groq
    if (groqKey && !response) {
      try {
        const res = await callGroq(messages, systemPrompt, groqKey);
        if (res.ok) { response = res; provider = 'groq'; }
        else { console.warn('Groq failed:', res.status); }
      } catch (e) {
        console.warn('Groq error:', (e as Error).message);
      }
    }

    // 3️⃣ Gemini
    if (geminiKey && !response) {
      try {
        const res = await callGemini(messages, systemPrompt, geminiKey);
        if (res.ok) { response = res; provider = 'gemini'; }
        else { console.warn('Gemini failed:', res.status); }
      } catch (e) {
        console.warn('Gemini error:', (e as Error).message);
      }
    }

    if (!response || !response.body) {
      return NextResponse.json(
        { error: 'All AI providers failed. Please try again.' },
        { status: 502, headers: corsHeaders },
      );
    }

    const stream = response.body.pipeThrough(createUnifiedStream(provider));

    return new NextResponse(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-AI-Provider': provider,
      },
    });

  } catch (error) {
    console.error('AI chat route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
