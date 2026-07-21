const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = 'sharedrop';
const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes

module.exports = { supabase, BUCKET, ROOM_TTL_MS };
