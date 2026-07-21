const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

// In-memory room registry: { roomCode: { createdAt, files: [] } }
const rooms = {};

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Generate a short 6-char alphanumeric room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Cleanup expired rooms every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of Object.entries(rooms)) {
    if (now - room.createdAt >= ROOM_TTL_MS) {
      // Delete room folder from disk
      const roomDir = path.join(UPLOAD_DIR, code);
      if (fs.existsSync(roomDir)) {
        fs.rmSync(roomDir, { recursive: true, force: true });
        console.log(`[Cleanup] Room ${code} deleted from disk.`);
      }
      delete rooms[code];
      console.log(`[Cleanup] Room ${code} expired and removed.`);
    }
  }
}, 30_000);

// Multer storage: save files in uploads/<roomCode>/
function createStorage(roomCode) {
  const roomDir = path.join(UPLOAD_DIR, roomCode);
  if (!fs.existsSync(roomDir)) fs.mkdirSync(roomDir, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, roomDir),
    filename: (req, file, cb) => {
      // Sanitize filename: keep original name, strip path separators
      const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-() ]/g, '_');
      cb(null, safe);
    },
  });
}

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────

/**
 * POST /api/create-room
 * Creates a new room and returns the room code + expiry timestamp.
 */
app.post('/api/create-room', (req, res) => {
  let code;
  // Ensure uniqueness
  do { code = generateRoomCode(); } while (rooms[code]);

  rooms[code] = { createdAt: Date.now(), files: [] };

  // Pre-create the directory
  const roomDir = path.join(UPLOAD_DIR, code);
  if (!fs.existsSync(roomDir)) fs.mkdirSync(roomDir, { recursive: true });

  console.log(`[Room] Created: ${code}`);
  res.json({
    success: true,
    roomCode: code,
    expiresAt: rooms[code].createdAt + ROOM_TTL_MS,
  });
});

/**
 * POST /api/upload/:roomCode
 * Uploads up to 10 files into the room folder.
 */
app.post('/api/upload/:roomCode', (req, res) => {
  const { roomCode } = req.params;

  if (!rooms[roomCode]) {
    return res.status(404).json({ success: false, error: 'Room not found or expired.' });
  }

  // Check TTL before upload
  if (Date.now() - rooms[roomCode].createdAt >= ROOM_TTL_MS) {
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  const upload = multer({
    storage: createStorage(roomCode),
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  }).array('files', MAX_FILES);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ success: false, error: 'Upload failed.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded.' });
    }

    const fileInfos = req.files.map((f) => ({
      name: f.filename,
      originalName: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
    }));

    rooms[roomCode].files.push(...fileInfos);
    console.log(`[Upload] ${req.files.length} file(s) uploaded to room ${roomCode}`);

    res.json({
      success: true,
      uploaded: fileInfos,
      roomCode,
      expiresAt: rooms[roomCode].createdAt + ROOM_TTL_MS,
    });
  });
});

/**
 * GET /api/room/:roomCode
 * Returns room info: file list and expiry time.
 */
app.get('/api/room/:roomCode', (req, res) => {
  const { roomCode } = req.params;

  if (!rooms[roomCode]) {
    return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  }

  if (Date.now() - rooms[roomCode].createdAt >= ROOM_TTL_MS) {
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  res.json({
    success: true,
    roomCode,
    files: rooms[roomCode].files,
    expiresAt: rooms[roomCode].createdAt + ROOM_TTL_MS,
    createdAt: rooms[roomCode].createdAt,
  });
});

/**
 * GET /api/download/:roomCode/:filename
 * Streams the requested file to the client.
 */
app.get('/api/download/:roomCode/:filename', (req, res) => {
  const { roomCode, filename } = req.params;

  if (!rooms[roomCode]) {
    return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  }

  if (Date.now() - rooms[roomCode].createdAt >= ROOM_TTL_MS) {
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  // Prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, roomCode, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }

  res.download(filePath, safeName, (err) => {
    if (err) console.error(`[Download] Error sending ${safeName}:`, err.message);
  });
});

/**
 * GET /api/status
 * Health check and active room count.
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: Object.keys(rooms).length,
    uptime: process.uptime(),
  });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ShareDrop running at http://localhost:${PORT}`);
  console.log(`   Room TTL: 5 minutes | Max files: ${MAX_FILES} | Max size: 100MB/file\n`);
});
