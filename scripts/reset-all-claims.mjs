/**
 * Reset completo di TUTTI i claim.
 * De-assegna tutti i contatti: assigned_to = null, claimed_at = null, status = 'todo'
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Resetting ALL claims...');

  const { data, error } = await supabase
    .from('contacts')
    .update({ assigned_to: null, claimed_at: null, status: 'todo' })
    .not('assigned_to', 'is', null)
    .select();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`Done! ${data?.length ?? 0} contacts have been reset to unassigned.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
