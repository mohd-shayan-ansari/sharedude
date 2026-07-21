const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();
const ROOM_TTL = 300; // 5 minutes in seconds

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = async function handler(req, res) {
  // CORS for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure unique room code
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
  } while ((await redis.exists(`room:${code}`)) && attempts < 10);

  const now = Date.now();
  const room = {
    files: [],
    createdAt: now,
    expiresAt: now + ROOM_TTL * 1000,
  };

  await redis.set(`room:${code}`, JSON.stringify(room), { ex: ROOM_TTL });

  console.log(`[Room] Created: ${code}`);
  return res.status(200).json({
    success: true,
    roomCode: code,
    expiresAt: room.expiresAt,
  });
};
