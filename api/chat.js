module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message manquant.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Clé API manquante.' });
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: 'Tu es Claude, assistant IA de Trebiq. Réponds de façon claire et concise en français (100-150 mots max). Tu es spécialisé en cybersécurité éthique.',
        messages: [{ role: 'user', content: message.slice(0, 280) }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', response.status, err);
      return res.status(502).json({ error: 'Service IA indisponible.' });
    }

    const data = await response.json();
    const reply = data.content?.map(b => b.text || '').join('') || '';
    if (!reply) return res.status(502).json({ error: 'Réponse vide.' });

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};
