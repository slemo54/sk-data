/**
 * Script di recovery: aggiorna le email dei contatti GuildSomm
 * leggendo dal CSV fornito e facendo match per Profile URL.
 *
 * NON crea nuovi contatti — aggiorna SOLO quelli esistenti.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const CSV_PATH = '/Users/Anselmo/Downloads/guildsomm scraped - Scraped Profiles Only.csv';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeUrl(url) {
  if (!url) return '';
  return url.toString().trim();
}

function parseCsv(path) {
  const raw = fs.readFileSync(path, 'utf-8');
  // Parse as raw rows first
  const rows = parse(raw, {
    skip_empty_lines: false,
    trim: true,
  });

  // Find header row (contains 'User ID')
  let headerIdx = rows.findIndex((r) => r.includes('User ID'));
  if (headerIdx === -1) {
    console.error('Could not find header row with "User ID"');
    process.exit(1);
  }

  const headers = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  return dataRows.map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] || '';
    }
    return obj;
  });
}

async function fetchGuildsommSources() {
  console.log('Fetching guildsomm contact_sources from DB...');
  const all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('contact_sources')
      .select('contact_id, profile_url')
      .eq('source', 'guildsomm')
      .not('profile_url', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching contact_sources:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Loaded ${all.length} guildsomm contact_sources`);
  return all;
}

async function main() {
  // 1. Load CSV
  console.log('Reading CSV...');
  const records = parseCsv(CSV_PATH);
  console.log(`CSV has ${records.length} data rows`);

  // Quick sanity check
  const sample = records.slice(0, 3);
  for (const r of sample) {
    console.log('Sample:', {
      name: r['Name'],
      url: r['Profile URL'],
      email: r['Public Email'],
    });
  }

  // 2. Load DB sources
  const sources = await fetchGuildsommSources();
  const urlToContactId = new Map();
  for (const s of sources) {
    const key = normalizeUrl(s.profile_url);
    if (key) {
      if (!urlToContactId.has(key)) {
        urlToContactId.set(key, s.contact_id);
      }
    }
  }
  console.log(`Mapped ${urlToContactId.size} unique profile URLs`);

  // 3. Build update list
  const updates = [];
  let matched = 0;
  let withEmail = 0;

  for (const row of records) {
    const profileUrl = normalizeUrl(row['Profile URL']);
    const email = (row['Public Email'] || '').trim() || null;

    if (!profileUrl) continue;
    const contactId = urlToContactId.get(profileUrl);
    if (!contactId) continue;

    matched++;
    if (email) {
      withEmail++;
      updates.push({ id: contactId, email });
    }
  }

  console.log(`Matched ${matched} CSV rows to DB contacts`);
  console.log(`Of those, ${withEmail} have an email to update`);

  if (updates.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  // 4. Batch update (chunk size 50)
  const CHUNK = 50;
  let updatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((u) =>
        supabase
          .from('contacts')
          .update({ email: u.email })
          .eq('id', u.id)
          .select('id')
          .single()
          .then(({ error }) => {
            if (error) {
              console.error(`Update failed for ${u.id}:`, error.message);
              return false;
            }
            return true;
          })
      )
    );
    updatedCount += results.filter(Boolean).length;
    errorCount += results.filter((r) => !r).length;

    if ((i + CHUNK) % 250 === 0 || i + CHUNK >= updates.length) {
      console.log(`  Progress: ${Math.min(i + CHUNK, updates.length)} / ${updates.length}`);
    }
  }

  console.log('\nDone!');
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
