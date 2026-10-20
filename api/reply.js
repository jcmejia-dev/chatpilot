const ALLOWED_ORIGINS = new Set([
  'https://chatpilot-dusky.vercel.app',
  'https://jcmejia-dev.github.io'
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function cleanResult(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid AI response');
  const replies = Array.isArray(value.replies)
    ? value.replies.filter(x => typeof x === 'string' && x.trim()).slice(0, 3)
    : [];
  if (replies.length !== 3) throw new Error('AI did not return three replies');
  return {
    intent: String(value.intent || 'Conversation'),
    mood: String(value.mood || 'Neutral'),
    strategy: String(value.strategy || 'Respond naturally and keep the conversation moving.'),
    replies: replies.map(x => x.trim()),
    source: 'groq'
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
  }

  const body = req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const persona = typeof body.persona === 'string' ? body.persona.slice(0, 80) : 'auto';
  const tone = typeof body.tone === 'string' ? body.tone.slice(0, 40) : 'natural';

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 6000) return res.status(413).json({ error: 'Message is too long' });

  const system = `You are ChatPilot, a human-in-the-loop reply coach for adult subscription-platform chatters. Analyze the pasted conversation and propose concise, natural replies for a human operator to review before manually sending. Keep replies non-graphic and non-explicit even if the incoming message is sexual; playful, flirty, teasing, affectionate, and suggestive language is okay, but do not describe explicit sexual acts or anatomy. Never invent facts, purchases, promises, availability, creator details, prices, discounts, refunds, free content, or policies that were not supplied. Do not pressure, threaten, manipulate, or claim the operator is an AI. Match the requested tone and personality when useful. Return ONLY valid JSON with exactly this shape: {"intent":"short label","mood":"short label","strategy":"one short sentence","replies":["best reply","alternative reply","low-pressure reply"]}. Each reply should usually be 1-2 short sentences and should respond directly to the actual incoming message.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.75,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Subscriber personality: ${persona}\nRequested reply tone: ${tone}\n\nRecent conversation / incoming message:\n${message}` }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Groq request failed', response.status, data?.error?.message || 'Unknown error');
      return res.status(502).json({ error: 'Groq request failed' });
    }

    const raw = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    return res.status(200).json(cleanResult(parsed));
  } catch (error) {
    console.error('ChatPilot reply error', error?.message || error);
    return res.status(500).json({ error: 'Unable to generate AI replies' });
  }
}
