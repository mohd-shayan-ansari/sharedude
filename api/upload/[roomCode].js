const { Redis } = require('@upstash/redis');
const { put } = require('@vercel/blob');
const busboy = require('busboy');

const redis = Redis.fromEnv();
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB — Vercel free tier request body limit

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomCode } = req.query;
  if (!roomCode) {
    return res.status(400).json({ success: false, error: 'Missing room code.' });
  }

  // Validate room exists and is not expired
  const raw = await redis.get(`room:${roomCode}`);
  if (!raw) {
    return res.status(404).json({ success: false, error: 'Room not found or expired.' });
  }
  const roomData = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (Date.now() >= roomData.expiresAt) {
    await redis.del(`room:${roomCode}`);
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  // Parse multipart form — one file per request
  return new Promise((resolve) => {
    const bb = busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    let uploadPromise = null;
    let sizeLimitHit = false;

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;
      const safeName = filename.replace(/[^a-zA-Z0-9._\-()\s]/g, '_');
      const contentType = mimeType || 'application/octet-stream';

      // Buffer the file
      const chunks = [];
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('limit', () => {
        sizeLimitHit = true;
        fileStream.resume(); // drain stream to avoid hanging
      });

      uploadPromise = new Promise((ok, fail) => {
        fileStream.on('end', async () => {
          if (sizeLimitHit) return ok(null);
          try {
            const buffer = Buffer.concat(chunks);
            const blob = await put(`rooms/${roomCode}/${safeName}`, buffer, {
              access: 'public',
              contentType,
              addRandomSuffix: false,
            });
            ok({
              name: safeName,
              originalName: filename,
              size: buffer.length,
              url: blob.url,
              mimetype: contentType,
            });
          } catch (err) {
            fail(err);
          }
        });
      });
    });

    bb.on('finish', async () => {
      try {
        if (sizeLimitHit) {
          res.status(413).json({ success: false, error: 'File exceeds the 4 MB limit.' });
          return resolve();
        }
        if (!uploadPromise) {
          res.status(400).json({ success: false, error: 'No file received.' });
          return resolve();
        }

        const fileInfo = await uploadPromise;
        if (!fileInfo) {
          res.status(400).json({ success: false, error: 'Upload failed.' });
          return resolve();
        }

        // Append file to room in Redis, preserving remaining TTL
        const ttl = await redis.ttl(`room:${roomCode}`);
        const updatedRoom = { ...roomData, files: [...roomData.files, fileInfo] };
        await redis.set(`room:${roomCode}`, JSON.stringify(updatedRoom), {
          ex: Math.max(ttl, 1),
        });

        console.log(`[Upload] ${fileInfo.originalName} → room ${roomCode}`);
        res.status(200).json({
          success: true,
          file: fileInfo,
          expiresAt: roomData.expiresAt,
        });
        resolve();
      } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Server error.' });
        resolve();
      }
    });

    bb.on('error', (err) => {
      res.status(500).json({ success: false, error: err.message });
      resolve();
    });

    req.pipe(bb);
  });
};
