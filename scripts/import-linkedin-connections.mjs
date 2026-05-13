#!/usr/bin/env node
import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  buildConnectionContact,
  parseConnectionsCsv,
} from './linkedin-connections-lib.mjs';

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

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const csvPath = getArg('--csv', '/Users/Anselmo/Downloads/Connections.csv');
const apply = hasFlag('--apply');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function mergeContacts(items) {
  const byKey = new Map();
  const sources = [];

  for (const item of items) {
    const key = `${item.contact.normalized_name}|${item.contact.country}|${item.contact.city}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.email ||= item.contact.email;
      existing.linkedin_url ||= item.contact.linkedin_url;
      if (existing.employer === 'no data') existing.employer = item.contact.employer;
      if (existing.title === 'no data') existing.title = item.contact.title;
      if (existing.occupation === 'no data') existing.occupation = item.contact.occupation;
    } else {
      byKey.set(key, { ...item.contact });
    }
    sources.push({ key, source: item.source });
  }

  return { contacts: [...byKey.values()], sources };
}

async function upsertContacts(contacts) {
  const returned = [];
  for (const pack of chunk(contacts, 500)) {
    const { data, error } = await supabase
      .from('contacts')
      .upsert(pack, { onConflict: 'normalized_name,country,city' })
      .select('id, normalized_name, country, city');

    if (error) throw error;
    returned.push(...(data ?? []));
  }
  return returned;
}

async function upsertSources(sourceRefs, contactRows) {
  const contactByKey = new Map(
    contactRows.map((contact) => [`${contact.normalized_name}|${contact.country}|${contact.city}`, contact]),
  );

  const sourceRows = sourceRefs
    .map(({ key, source }) => {
      const contact = contactByKey.get(key);
      if (!contact) return null;
      return {
        contact_id: contact.id,
        ...source,
      };
    })
    .filter(Boolean);

  let count = 0;
  for (const pack of chunk(sourceRows, 500)) {
    const { data, error } = await supabase
      .from('contact_sources')
      .upsert(pack, { onConflict: 'source,source_key' })
      .select('id');

    if (error) throw error;
    count += data?.length ?? 0;
  }

  return count;
}

async function main() {
  const rows = parseConnectionsCsv(fs.readFileSync(csvPath, 'utf8'));
  const items = rows.map(buildConnectionContact).filter(Boolean);
  const { contacts, sources } = mergeContacts(items);

  const preview = {
    csvPath,
    csvRows: rows.length,
    validRows: items.length,
    uniqueContacts: contacts.length,
    sources: sources.length,
    sample: contacts.slice(0, 5),
  };

  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/linkedin-connections-import-preview.json', JSON.stringify(preview, null, 2));

  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update Supabase.');
    return;
  }

  const contactRows = await upsertContacts(contacts);
  const sourceCount = await upsertSources(sources, contactRows);

  console.log(`Upserted ${contactRows.length} contacts`);
  console.log(`Upserted ${sourceCount} source rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
