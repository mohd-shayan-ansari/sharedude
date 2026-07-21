const { supabase, ROOM_TTL_MS } = require('../lib/supabase');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Generate a unique room code
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      const { data } = await supabase
        .from('rooms')
        .select('code')
        .eq('code', code)
        .gt('expires_at', Date.now())
        .maybeSingle();
      if (!data) break; // Code is free
      attempts++;
    } while (attempts < 10);

    const now = Date.now();
    const expiresAt = now + ROOM_TTL_MS;

    const { error } = await supabase
      .from('rooms')
      .upsert({ code, files: [], created_at: now, expires_at: expiresAt });

    if (error) {
      console.error('[create-room]', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`[Room] Created: ${code}`);
    return res.status(200).json({ success: true, roomCode: code, expiresAt });
  } catch (err) {
    console.error('Error in create-room:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create room.' });
  }
};
