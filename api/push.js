const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subscription, title, body, url } = req.body;
    if (!subscription) return res.status(400).json({ error: 'No subscription' });

    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: url || '/' }));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Push error:', err);
    res.status(500).json({ error: err.message });
  }
};
