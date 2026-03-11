export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { message } = req.body || {};
  
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'Tu es un assistant IA sur Trebiq, un réseau social. Réponds de façon naturelle et conversationnelle, comme un tweet ou un post. Maximum 3 phrases courtes. N\'utilise JAMAIS de Markdown (pas de **, ##, |, -, *). Pas de tableaux, pas de titres, pas de listes à puces. Réponds directement et simplement en français.',
      messages: [{ role: 'user', content: message }]
    })
  });
  
  const data = await r.json();
  const reply = data.content?.[0]?.text || 'Erreur';
  res.status(200).json({ reply });
}
