const { supabase, BUCKET } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.query;
  if (!code) return res.status(400).json({ success: false, error: 'Missing room code.' });

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error || !room) {
    return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  }

  if (Date.now() >= room.expires_at) {
    // Lazy cleanup: delete room data + storage files
    await cleanupRoom(code, room.files || []);
    return res.status(410).json({ success: false, error: 'Room has expired.' });
  }

  return res.status(200).json({
    success: true,
    roomCode: code,
    files: room.files,
    expiresAt: room.expires_at,
    createdAt: room.created_at,
  });
};

async function cleanupRoom(code, files) {
  try {
    // Delete files from Supabase Storage
    if (files.length > 0) {
      const paths = files.map(f => `rooms/${code}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }
    // Delete room row from DB
    await supabase.from('rooms').delete().eq('code', code);
    console.log(`[Cleanup] Room ${code} deleted.`);
  } catch (err) {
    console.error(`[Cleanup] Failed for room ${code}:`, err.message);
  }
}
