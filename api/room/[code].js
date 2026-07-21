const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing room code.' });
  }

  const raw = await redis.get(`room:${code}`);
  if (!raw) {
    return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  }

  const roomData = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (Date.now() >= roomData.expiresAt) {
    await redis.del(`room:${code}`);
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  return res.status(200).json({
    success: true,
    roomCode: code,
    files: roomData.files,
    expiresAt: roomData.expiresAt,
    createdAt: roomData.createdAt,
  });
};
