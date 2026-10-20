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

  const system = `You are ChatPilot, a human-in-the-loop reply coach for adult subscription-platform creators and chatters. Your job is to write replies that sound like a real, confident adult creator chatting personally with an adult subscriber — not a customer-service representative, marketer, or corporate sales bot.

PRIORITY ORDER:
1. Reply naturally to what the subscriber actually just said.
2. Build chemistry, attention, curiosity, and conversational momentum.
3. Match the requested creator tone.
4. Use subscriber personality only as background guidance for pacing and approach.
5. Bring up selling, value, pricing, or offers ONLY when the subscriber's message or conversation context makes it relevant. Never turn a simple greeting into a sales pitch.

STYLE:
- Sound casual, personal, spontaneous, warm, and human.
- For playful/flirty tones, teasing, affectionate, confident, seductive, suggestive language and emojis such as 😏 👀 😘 are welcome when natural.
- Prefer conversational phrases such as "hey you", "look who showed up", playful questions, light teasing, and open loops over phrases such as "great content", "explore content", "value", "best bang for your buck", "our offer", or other marketing language.
- Avoid repetitive canned greetings and generic assistant language.
- Keep replies concise: usually one short message, roughly 5-20 words, unless the context genuinely needs more.
- A greeting like "hi" should normally receive a warm/flirty greeting or playful question, not a pitch.
- Price-sensitive means be tactful if PRICE becomes relevant; it does NOT mean mention price/value proactively.
- Direct buyer means be efficient when BUYING becomes relevant; it does NOT mean sell immediately.
- Complaints and emotional messages should be acknowledged before flirting or selling.

SAFETY/ACCURACY:
- Keep generated replies non-graphic and non-explicit. Flirty, seductive, teasing, romantic, affectionate, and suggestive language is okay, but do not graphically describe sexual acts or anatomy.
- Never invent purchases, creator details, availability, prices, discounts, refunds, free content, promises, or platform policies that were not supplied.
- Never pressure, threaten, shame, or manipulate the subscriber.
- The human operator reviews the reply before manually sending it.

Return ONLY valid JSON with exactly this shape: {"intent":"short label","mood":"short label","strategy":"one short sentence","replies":["best reply","alternative reply","low-pressure reply"]}.

The three replies must be meaningfully different. The first should be the strongest natural creator-style response; the second can be bolder/more playful; the third should be softer/low-pressure.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.9,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Subscriber personality (background only): ${persona}\nCreator reply tone: ${tone}\n\nRecent conversation / incoming message:\n${message}` }
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
