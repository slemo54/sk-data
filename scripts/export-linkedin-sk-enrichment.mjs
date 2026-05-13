#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeCell, normalizeLinkedinUrl, toCsv } from './linkedin-sk-enrichment-lib.mjs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const outputPath = getArg('--out', 'tmp/linkedin-sk-enrichment-template.csv');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAllLinkedinSkSources() {
  const all = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from('contact_sources')
      .select('contact_id, source_key, profile_url, raw_data')
      .eq('source', 'linkedin_sk')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < pageSize) break;
    page += 1;
  }

  return all;
}

async function fetchContactsById(ids) {
  const contacts = new Map();
  const chunkSize = 100;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, linkedin_url, city, country, occupation, employer')
      .in('id', chunk);

    if (error) throw error;
    for (const contact of data ?? []) {
      contacts.set(contact.id, contact);
    }
  }

  return contacts;
}

function editableValue(value) {
  const normalized = normalizeCell(value);
  return normalized === 'no data' ? '' : normalized ?? '';
}

async function main() {
  const sources = await fetchAllLinkedinSkSources();
  const contacts = await fetchContactsById([...new Set(sources.map((source) => source.contact_id))]);

  const rows = sources
    .map((source) => {
      const contact = contacts.get(source.contact_id);
      const skills = Array.isArray(source.raw_data?.skills) ? source.raw_data.skills.join('; ') : '';

      return {
        contact_id: source.contact_id,
        full_name: contact?.full_name ?? '',
        linkedin_url: normalizeLinkedinUrl(contact?.linkedin_url || source.profile_url),
        city: editableValue(contact?.city),
        country: editableValue(contact?.country),
        occupation: editableValue(contact?.occupation),
        employer: editableValue(contact?.employer),
        current_city: contact?.city ?? '',
        current_country: contact?.country ?? '',
        current_occupation: contact?.occupation ?? '',
        current_employer: contact?.employer ?? '',
        source_key: source.source_key,
        endorsement_count: source.raw_data?.endorsement_count ?? '',
        skills,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const headers = [
    'contact_id',
    'full_name',
    'linkedin_url',
    'city',
    'country',
    'occupation',
    'employer',
    'current_city',
    'current_country',
    'current_occupation',
    'current_employer',
    'source_key',
    'endorsement_count',
    'skills',
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${toCsv(rows, headers)}\n`);

  console.log(`Exported ${rows.length} LinkedIn SK rows to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
