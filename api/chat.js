// api/chat.js — Vercel Serverless Function
// Gère les appels à l'API Claude de façon sécurisée

const RATE_LIMIT = new Map(); // IP → { count, resetTime }
const MAX_REQUESTS_PER_HOUR = 15; // par IP
const MAX_TEXT_LENGTH = 280;

export default async function handler(req, res) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  // ── RATE LIMITING par IP ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);

  if (entry) {
    if (now < entry.resetTime) {
      if (entry.count >= MAX_REQUESTS_PER_HOUR) {
        return res.status(429).json({
          error: 'Trop de requêtes. Limite : 15 messages par heure par utilisateur.',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000 / 60) + ' minutes'
        });
      }
      entry.count++;
    } else {
      RATE_LIMIT.set(ip, { count: 1, resetTime: now + 3600000 });
    }
  } else {
    RATE_LIMIT.set(ip, { count: 1, resetTime: now + 3600000 });
  }

  // Nettoyer les vieilles entrées toutes les 100 requêtes
  if (RATE_LIMIT.size > 1000) {
    for (const [key, val] of RATE_LIMIT.entries()) {
      if (now > val.resetTime) RATE_LIMIT.delete(key);
    }
  }

  // ── VALIDATION INPUT ──
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message manquant ou invalide.' });
  }

  const cleanMessage = message.trim().slice(0, MAX_TEXT_LENGTH);

  if (cleanMessage.length < 2) {
    return res.status(400).json({ error: 'Message trop court.' });
  }

  // ── PATTERNS BLOQUÉS (sécurité) ──
  const BLOCKED = [
    /comment\s+(tuer|assassiner|violer)\s/i,
    /fabri(quer|cation)\s+(bombe|explosif)/i,
    /child\s*(porn|abuse)/i,
    /\b(csam|pedoporn)\b/i,
  ];
  if (BLOCKED.some(r => r.test(cleanMessage))) {
    return res.status(400).json({ error: 'Contenu non autorisé par nos CGU.' });
  }

  // ── APPEL API ANTHROPIC ──
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Configuration serveur manquante.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `Tu es Claude, l'agent IA de Trebiq, réseau social éducatif Trebiq (propulsé par Claude, Anthropic) sur la cybersécurité. Réponds de façon engageante, claire et concise (100-150 mots max).

RÈGLES STRICTES :
- Refuse toute aide pour des activités illégales (piratage non autorisé, fraude, violence)
- Ne fournis jamais d'instructions pour attaquer des systèmes réels sans autorisation
- Précise que le hacking éthique nécessite une autorisation préalable
- Tes réponses ne remplacent pas un avis professionnel
- Mentionne TryHackMe, HackTheBox, Root-Me pour la pratique légale

STYLE : Expert pédagogue, accessible, 1-2 emojis max, approche légale et éthique.`,
        messages: [{ role: 'user', content: cleanMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, err);
      return res.status(502).json({ error: 'Service IA temporairement indisponible.' });
    }

    const data = await response.json();
    const reply = data.content?.map(b => b.text || '').join('') || '';

    if (!reply) return res.status(502).json({ error: 'Réponse IA vide.' });

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erreur serveur interne.' });
  }
}
