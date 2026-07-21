require('dotenv').config();
const { supabase } = require('./lib/supabase');

async function test() {
  const code = 'TEST12';
  const now = Date.now();
  const expiresAt = now + 300000;

  const { data, error } = await supabase
    .from('rooms')
    .upsert({ code, files: [], created_at: now, expires_at: expiresAt });

  if (error) {
    console.error("Upsert Error:", error);
  } else {
    console.log("Upsert Success!");
  }
}

test();
