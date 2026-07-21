const { supabase, BUCKET } = require('../../lib/supabase');

// Returns a Supabase signed upload URL so the browser can PUT the file
// DIRECTLY to Supabase Storage — bypassing Vercel's 4.5 MB body limit entirely.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { roomCode } = req.query;

  // Read JSON body
  let body = '';
  await new Promise((resolve) => { req.on('data', c => (body += c)); req.on('end', resolve); });
  let filename, contentType;
  try {
    ({ filename, contentType } = JSON.parse(body));
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
  }

  if (!filename) return res.status(400).json({ success: false, error: 'Missing filename.' });

  // Validate room
  const { data: room } = await supabase
    .from('rooms')
    .select('expires_at')
    .eq('code', roomCode)
    .maybeSingle();

  if (!room) return res.status(404).json({ success: false, error: 'Room not found or expired.' });
  if (Date.now() >= room.expires_at) return res.status(410).json({ success: false, error: 'Room has expired.' });

  // Sanitize filename and build storage path
  const safeName = filename.replace(/[^a-zA-Z0-9._\-()\s]/g, '_');
  const storagePath = `rooms/${roomCode}/${safeName}`;

  // Create a signed upload URL (valid for 5 minutes)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error) {
    console.error('[upload-url]', error.message);
    return res.status(500).json({ success: false, error: 'Could not generate upload URL.' });
  }

  return res.status(200).json({
    success: true,
    signedUrl: data.signedUrl,
    safeName,
    storagePath,
  });
};
