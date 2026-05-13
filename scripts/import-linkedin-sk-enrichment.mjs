#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  buildContactPatch,
  normalizeLinkedinUrl,
  parseEnrichmentCsv,
} from './linkedin-sk-enrichment-lib.mjs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const csvPath = getArg('--csv');
const apply = hasFlag('--apply');

if (!csvPath) {
  console.error('Usage: node scripts/import-linkedin-sk-enrichment.mjs --csv <file.csv> [--apply]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveContactIds(rows) {
  const unresolvedRows = rows.filter((row) => !row.contact_id);
  const sourceKeys = new Set(unresolvedRows.map((row) => row.source_key).filter(Boolean));
  const urls = new Set(
    unresolvedRows
      .map((row) => normalizeLinkedinUrl(row.linkedin_url || row.profile_url))
      .filter(Boolean),
  );

  const bySourceKey = new Map();
  const byUrl = new Map();

  if (sourceKeys.size) {
    const { data, error } = await supabase
      .from('contact_sources')
      .select('contact_id, source_key')
      .eq('source', 'linkedin_sk')
      .in('source_key', [...sourceKeys]);

    if (error) throw error;
    for (const source of data ?? []) {
      bySourceKey.set(source.source_key, source.contact_id);
    }
  }

  if (urls.size) {
    const { data, error } = await supabase
      .from('contact_sources')
      .select('contact_id, profile_url')
      .eq('source', 'linkedin_sk')
      .in('profile_url', [...urls]);

    if (error) throw error;
    for (const source of data ?? []) {
      byUrl.set(normalizeLinkedinUrl(source.profile_url), source.contact_id);
    }
  }

  return rows.map((row) => ({
    row,
    contactId:
      row.contact_id ||
      bySourceKey.get(row.source_key) ||
      byUrl.get(normalizeLinkedinUrl(row.linkedin_url || row.profile_url)) ||
      null,
    patch: buildContactPatch(row),
  })).filter((item) => item.contactId && Object.keys(item.patch).length > 0);
}

async function main() {
  const records = parseEnrichmentCsv(fs.readFileSync(csvPath, 'utf8'));
  const updates = await resolveContactIds(records);

  const previewPath = 'tmp/linkedin-sk-enrichment-preview.json';
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, JSON.stringify(updates, null, 2));

  console.log(`Read ${records.length} rows from ${csvPath}`);
  console.log(`Prepared ${updates.length} contact updates`);
  console.log(`Preview written to ${previewPath}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update Supabase.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const item of updates) {
    const { error } = await supabase
      .from('contacts')
      .update({
        ...item.patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.contactId);

    if (error) {
      failed += 1;
      console.error(`Failed ${item.contactId}: ${error.message}`);
    } else {
      updated += 1;
    }
  }

  console.log(`Updated ${updated} contacts`);
  console.log(`Failed ${failed} contacts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
