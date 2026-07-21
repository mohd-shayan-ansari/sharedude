const { supabase, BUCKET } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, file } = req.query;
  if (!code || !file) return res.status(400).json({ error: 'Missing code or file parameter.' });

  // Validate room is alive
  const { data: room } = await supabase
    .from('rooms')
    .select('files, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (!room) return res.status(404).json({ success: false, error: 'Room not found or has expired.' });
  if (Date.now() >= room.expires_at) return res.status(410).json({ success: false, error: 'Room has expired.' });

  // Find the file entry
  const fileInfo = (room.files || []).find(
    f => f.name === file || f.originalName === file
  );
  if (!fileInfo) return res.status(404).json({ success: false, error: 'File not found in this room.' });

  // Create a short-lived signed download URL (60 seconds — just enough for the browser to start the download)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(`rooms/${code}/${fileInfo.name}`, 60);

  if (error || !data) {
    return res.status(500).json({ success: false, error: 'Could not generate download link.' });
  }

  // Redirect browser to the CDN URL — triggers a native download
  res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.originalName || fileInfo.name}"`);
  return res.redirect(302, data.signedUrl);
};
