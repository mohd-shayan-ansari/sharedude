const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, file } = req.query;
  if (!code || !file) {
    return res.status(400).json({ error: 'Missing code or file parameter.' });
  }

  const raw = await redis.get(`room:${code}`);
  if (!raw) {
    return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  }

  const roomData = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (Date.now() >= roomData.expiresAt) {
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  // Find matching file (by safe name or original name)
  const fileInfo = roomData.files.find(
    (f) => f.name === file || f.originalName === file || decodeURIComponent(file) === f.name
  );

  if (!fileInfo || !fileInfo.url) {
    return res.status(404).json({ success: false, error: 'File not found in this room.' });
  }

  // Redirect browser directly to the Vercel Blob CDN URL
  // This triggers a native download in the browser
  res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.originalName || fileInfo.name}"`);
  res.redirect(302, fileInfo.url);
};
