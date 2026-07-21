const { supabase } = require('../../lib/supabase');

// Called by the browser AFTER it has successfully PUT the file to Supabase Storage.
// Stores the file metadata in the rooms table so the receiver can see it.
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
  let name, originalName, size, mimetype;
  try {
    ({ name, originalName, size, mimetype } = JSON.parse(body));
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
  }

  // Fetch current room state
  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('files, expires_at')
    .eq('code', roomCode)
    .maybeSingle();

  if (!room || fetchErr) return res.status(404).json({ success: false, error: 'Room not found.' });
  if (Date.now() >= room.expires_at) return res.status(410).json({ success: false, error: 'Room has expired.' });

  const fileEntry = { name, originalName, size, mimetype };
  const updatedFiles = [...(room.files || []), fileEntry];

  const { error: updateErr } = await supabase
    .from('rooms')
    .update({ files: updatedFiles })
    .eq('code', roomCode);

  if (updateErr) {
    console.error('[register-file]', updateErr.message);
    return res.status(500).json({ success: false, error: 'Failed to register file.' });
  }

  console.log(`[Register] ${originalName} → room ${roomCode}`);
  return res.status(200).json({ success: true, file: fileEntry });
};
