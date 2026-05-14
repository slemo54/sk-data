#!/usr/bin/env node
import fs from 'node:fs';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { cleanCell, normalizeName } from './linkedin-connections-lib.mjs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_CSV = '/Users/Anselmo/Downloads/Contatti_LinkedIn_Export - Contatti_LinkedIn_Export.csv';
const COUNTRY_ONLY_LOCATIONS = new Set([
  'China',
  'United Kingdom',
  'United States',
  'Italy',
  'France',
  'Spain',
  'Germany',
  'Canada',
  'Australia',
]);

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

function parseExport(csvText) {
  const rows = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  return rows
    .map((row) => {
      const fullName = cleanCell(row['Nome Cognome']);
      if (!fullName) return null;
      return {
        fullName,
        normalizedName: normalizeName(fullName),
        occupation: cleanCell(row['Job Title']),
        city: cleanCell(row['City & State']),
        country: cleanCell(row.Country),
        raw: row,
      };
    })
    .filter(Boolean);
}

function isMissing(value) {
  return !value || value.trim().toLowerCase() === 'no data';
}

function hasRealLocation(contact) {
  return !isMissing(contact.city) || !isMissing(contact.country);
}

function cleanNoDataLocation(contact) {
  const patch = {};

  if (!contact.city?.toLowerCase().includes('no data') && !contact.country?.toLowerCase().includes('no data')) {
    return patch;
  }

  const cityParts = (contact.city ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== 'no data');
  const countryParts = (contact.country ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== 'no data');

  if (cityParts.length) {
    patch.city = cityParts.join(', ');
  }

  if (countryParts.length) {
    patch.country = countryParts.join(', ');
  }

  if (!countryParts.length && cityParts.length >= 2) {
    const maybeCountry = cityParts.at(-1);
    if (maybeCountry && /^[A-Za-z][A-Za-z .'-]+$/.test(maybeCountry) && maybeCountry.length > 2) {
      patch.country = maybeCountry;
      patch.city = cityParts.slice(0, -1).join(', ');
    }
  }

  if (!countryParts.length && cityParts.length === 1 && COUNTRY_ONLY_LOCATIONS.has(cityParts[0])) {
    patch.country = cityParts[0];
    patch.city = null;
  }

  return patch;
}

function setIfChanged(patch, contact, field, value) {
  if ((contact[field] ?? null) !== (value ?? null)) {
    patch[field] = value;
  }
}

async function fetchLinkedinContacts(supabase) {
  const contacts = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('contacts')
      .select('id,full_name,normalized_name,city,country,linkedin_url,next_action,status,title,occupation,contact_sources!inner(source)')
      .eq('contact_sources.source', 'linkedin_sk')
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;
    contacts.push(...data);
    if (data.length < pageSize) break;
  }

  return contacts;
}

function buildUpdates(exportRows, linkedinContacts) {
  const rowsByName = new Map();
  for (const row of exportRows) {
    if (!row.city && !row.country && !row.occupation) continue;
    const existing = rowsByName.get(row.normalizedName);
    if (!existing) {
      rowsByName.set(row.normalizedName, [row]);
    } else {
      existing.push(row);
    }
  }

  const contactsByName = new Map();
  for (const contact of linkedinContacts) {
    const existing = contactsByName.get(contact.normalized_name);
    if (!existing) {
      contactsByName.set(contact.normalized_name, [contact]);
    } else {
      existing.push(contact);
    }
  }

  const updates = [];
  const skippedAmbiguous = [];

  for (const [normalizedName, rows] of rowsByName.entries()) {
    const contacts = contactsByName.get(normalizedName) ?? [];
    if (!contacts.length) continue;

    const uniqueRows = rows.filter((row, index, all) => (
      all.findIndex((candidate) => (
        candidate.city === row.city &&
        candidate.country === row.country &&
        candidate.occupation === row.occupation
      )) === index
    ));

    if (contacts.length > 1 || uniqueRows.length > 1) {
      skippedAmbiguous.push({
        normalizedName,
        csvRows: rows.length,
        contacts: contacts.map((contact) => ({
          id: contact.id,
          full_name: contact.full_name,
          city: contact.city,
          country: contact.country,
        })),
      });
      continue;
    }

    const row = uniqueRows[0];
    const contact = contacts[0];
    const patch = cleanNoDataLocation(contact);

    if (row.city && (isMissing(contact.city) || contact.city?.toLowerCase().includes('no data'))) {
      setIfChanged(patch, contact, 'city', row.city);
    }

    if (row.country && (isMissing(contact.country) || contact.country?.toLowerCase().includes('no data'))) {
      setIfChanged(patch, contact, 'country', row.country);
    }

    if (row.city && !row.country && isMissing(contact.country)) {
      setIfChanged(patch, contact, 'country', null);
    }

    if (!row.city && row.country && isMissing(contact.city)) {
      setIfChanged(patch, contact, 'city', null);
    }

    if (row.occupation && (isMissing(contact.occupation) || isMissing(contact.title))) {
      if (isMissing(contact.occupation)) setIfChanged(patch, contact, 'occupation', row.occupation);
      if (isMissing(contact.title)) setIfChanged(patch, contact, 'title', row.occupation);
    }

    if (Object.keys(patch).length) {
      updates.push({
        id: contact.id,
        full_name: contact.full_name,
        linkedin_url: contact.linkedin_url,
        before: {
          city: contact.city,
          country: contact.country,
          next_action: contact.next_action,
          status: contact.status,
          title: contact.title,
          occupation: contact.occupation,
        },
        patch,
        csv: row.raw,
      });
    }
  }

  for (const contact of linkedinContacts) {
    const alreadyQueued = updates.some((update) => update.id === contact.id);
    if (alreadyQueued) continue;

    const patch = cleanNoDataLocation(contact);
    if (Object.keys(patch).length) {
      updates.push({
        id: contact.id,
        full_name: contact.full_name,
        linkedin_url: contact.linkedin_url,
        before: {
          city: contact.city,
          country: contact.country,
          next_action: contact.next_action,
          status: contact.status,
          title: contact.title,
          occupation: contact.occupation,
        },
        patch,
        csv: null,
      });
    }
  }

  return { updates, skippedAmbiguous };
}

async function applyUpdates(supabase, updates) {
  let updated = 0;

  for (const pack of chunk(updates, 100)) {
    await Promise.all(pack.map(async (update) => {
      const { error } = await supabase
        .from('contacts')
        .update({
          ...update.patch,
          ...(
            update.linkedinReady
              ? { next_action: 'pronto_da_contattare', status: 'reviewed' }
              : {}
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id);

      if (error) throw error;
      updated += 1;
    }));
  }

  return updated;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const csvPath = getArg('--csv', DEFAULT_CSV);
  const apply = hasFlag('--apply');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const exportRows = parseExport(fs.readFileSync(csvPath, 'utf8'));
  const linkedinContacts = await fetchLinkedinContacts(supabase);
  const { updates, skippedAmbiguous } = buildUpdates(exportRows, linkedinContacts);
  const updatesWithReadyRule = updates.map((update) => {
    const after = { ...update.before, ...update.patch };
    return {
      ...update,
      linkedinReady: Boolean(update.linkedin_url) && hasRealLocation(after),
    };
  });

  fs.mkdirSync('tmp', { recursive: true });
  const preview = {
    csvPath,
    csvRows: exportRows.length,
    linkedinContacts: linkedinContacts.length,
    updates: updatesWithReadyRule.length,
    linkedinReadyUpdates: updatesWithReadyRule.filter((update) => update.linkedinReady).length,
    skippedAmbiguous: skippedAmbiguous.length,
    sampleUpdates: updatesWithReadyRule.slice(0, 10),
    sampleSkippedAmbiguous: skippedAmbiguous.slice(0, 10),
  };
  fs.writeFileSync('tmp/linkedin-location-enrichment-preview.json', JSON.stringify(preview, null, 2));
  fs.writeFileSync('tmp/linkedin-location-enrichment-rollback.json', JSON.stringify({
    created_at: new Date().toISOString(),
    updates: updatesWithReadyRule.map(({ id, full_name, before }) => ({ id, full_name, before })),
  }, null, 2));

  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update Supabase.');
    return;
  }

  const updated = await applyUpdates(supabase, updatesWithReadyRule);
  console.log(`Updated ${updated} contacts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
