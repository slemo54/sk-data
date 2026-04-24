#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);

function getArg(name, fallback = null) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return argv.includes(name);
}

function normalize(value) {
  return (value ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeText(value) {
  const trimmed = (value ?? '').toString().trim();
  return trimmed.length ? trimmed : null;
}

function buildMatchKey(name, country, city) {
  const normalizedName = normalize(name);
  const normalizedCountry = normalize(country);
  const normalizedCity = normalize(city);

  if (!normalizedName || !normalizedCountry || !normalizedCity) {
    return null;
  }

  return `${normalizedName}||${normalizedCountry}||${normalizedCity}`;
}

function parseCsvLine(line) {
  const output = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      output.push(current);
      current = '';
    } else if (ch !== '\r') {
      current += ch;
    }
  }

  output.push(current);
  return output;
}

function parseGuildsommCsv(csvText) {
  const lines = csvText.split('\n');
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim()) {
      return false;
    }
    const cols = parseCsvLine(line).map((col) => normalize(col));
    return cols.includes('user id');
  });

  if (headerIndex < 0) {
    throw new Error('GuildSomm CSV header row not found (expected a row with "User ID").');
  }

  const headers = parseCsvLine(lines[headerIndex]).map((header) => header.trim());
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function toHeaderMap(row) {
  const mapped = new Map();
  Object.entries(row).forEach(([key, value]) => {
    mapped.set(normalize(key), value);
  });
  return mapped;
}

function pickValue(map, keys) {
  for (const key of keys) {
    const value = map.get(normalize(key));
    if (value && value.toString().trim()) {
      return value.toString().trim();
    }
  }
  return '';
}

function buildGuildContact(row) {
  const map = toHeaderMap(row);
  const userId = pickValue(map, ['User ID', 'ID']);
  const firstName = pickValue(map, ['First Name']);
  const lastName = pickValue(map, ['Last Name']);
  const fullName =
    pickValue(map, ['Full Name', 'Name', 'Display Name']) ||
    `${firstName} ${lastName}`.trim();

  return {
    full_name: fullName,
    normalized_name: normalize(fullName),
    city: normalizeText(pickValue(map, ['City', 'Current City'])),
    country: normalizeText(pickValue(map, ['Country', 'Current Country'])),
    email: normalizeText(pickValue(map, ['Email', 'Primary Email'])),
    instagram_url: normalizeText(pickValue(map, ['Instagram URL', 'Instagram', 'IG', 'Instagram Profile'])),
    linkedin_url: normalizeText(pickValue(map, ['LinkedIn URL', 'LinkedIn', 'Linkedin'])),
    employer: normalizeText(pickValue(map, ['Employer', 'Company', 'Organization'])),
    title: normalizeText(pickValue(map, ['Title', 'Job Title'])),
    occupation: normalizeText(pickValue(map, ['Occupation', 'Role'])),
    cms_cert: normalizeText(pickValue(map, ['CMS Certification', 'CMS Cert', 'Certification'])),
    source: {
      source: 'guildsomm',
      source_key: userId || pickValue(map, ['Profile URL', 'URL', 'Profile']) || `guildsomm:${fullName}`,
      profile_url: normalizeText(pickValue(map, ['Profile URL', 'URL', 'Profile'])),
      raw_data: row,
    },
  };
}

function buildWineAwardContacts(restaurants) {
  const roles = [
    { key: 'wine_director', label: 'Wine Director' },
    { key: 'sommelier', label: 'Sommelier' },
    { key: 'general_manager', label: 'General Manager' },
  ];

  const contacts = [];

  restaurants.forEach((restaurant) => {
    roles.forEach((role) => {
      const name = normalizeText(restaurant[role.key]);
      if (!name) {
        return;
      }

      contacts.push({
        full_name: name,
        normalized_name: normalize(name),
        city: normalizeText(restaurant.city),
        country: normalizeText(restaurant.country),
        email: null,
        instagram_url: null,
        linkedin_url: null,
        employer: normalizeText(restaurant.restaurant),
        title: role.label,
        occupation: 'Hospitality',
        cms_cert: null,
        source: {
          source: 'wine_awards',
          source_key: `wine_awards:${restaurant.id}:${role.key}`,
          restaurant_name: normalizeText(restaurant.restaurant),
          award: normalizeText(restaurant.award),
          wine_role: role.label,
          profile_url: null,
          raw_data: {
            id: restaurant.id,
            restaurant: restaurant.restaurant,
            city: restaurant.city,
            country: restaurant.country,
            award: restaurant.award,
            role: role.key,
          },
        },
      });
    });
  });

  return contacts;
}

function mergeContacts(wineContacts, guildContacts) {
  const entities = [];
  const byMatchKey = new Map();

  function createEntity(contact) {
    const entity = {
      full_name: contact.full_name,
      normalized_name: contact.normalized_name,
      city: contact.city,
      country: contact.country,
      email: contact.email,
      instagram_url: contact.instagram_url,
      linkedin_url: contact.linkedin_url,
      employer: contact.employer,
      title: contact.title,
      occupation: contact.occupation,
      cms_cert: contact.cms_cert,
      review_status: 'unseen',
      next_action: null,
      approval: false,
      contacted: false,
      notes: null,
      status: 'todo',
      assigned_to: null,
      claimed_at: null,
      reviewed_at: null,
      sources: [contact.source],
    };

    entities.push(entity);

    const key = buildMatchKey(contact.full_name, contact.country, contact.city);
    if (key && !byMatchKey.has(key)) {
      byMatchKey.set(key, entity);
    }

    return entity;
  }

  wineContacts.forEach((contact) => createEntity(contact));

  let matched = 0;
  let unmatched = 0;

  guildContacts.forEach((contact) => {
    const key = buildMatchKey(contact.full_name, contact.country, contact.city);
    const existing = key ? byMatchKey.get(key) : null;

    if (existing) {
      matched += 1;
      existing.email = existing.email || contact.email;
      existing.instagram_url = existing.instagram_url || contact.instagram_url;
      existing.linkedin_url = existing.linkedin_url || contact.linkedin_url;
      existing.employer = existing.employer || contact.employer;
      existing.title = existing.title || contact.title;
      existing.occupation = existing.occupation || contact.occupation;
      existing.cms_cert = existing.cms_cert || contact.cms_cert;
      existing.sources.push(contact.source);
      return;
    }

    unmatched += 1;
    createEntity(contact);
  });

  return {
    contacts: entities,
    matched,
    unmatched,
  };
}

function chunk(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function upsertSupabase(contacts) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase env vars. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const contactsPayload = contacts.map((contact) => ({
    full_name: contact.full_name,
    normalized_name: contact.normalized_name,
    city: contact.city,
    country: contact.country,
    email: contact.email,
    instagram_url: contact.instagram_url,
    linkedin_url: contact.linkedin_url,
    employer: contact.employer,
    title: contact.title,
    occupation: contact.occupation,
    cms_cert: contact.cms_cert,
    review_status: contact.review_status ?? 'unseen',
    next_action: contact.next_action ?? null,
    approval: contact.approval ?? false,
    contacted: contact.contacted ?? false,
    notes: contact.notes ?? null,
    status: contact.status,
    assigned_to: contact.assigned_to,
    claimed_at: contact.claimed_at,
    reviewed_at: contact.reviewed_at,
  }));

  const contactIdByKey = new Map();

  for (const pack of chunk(contactsPayload, 500)) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/contacts?on_conflict=normalized_name,country,city&select=id,normalized_name,country,city`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(pack),
      },
    );

    if (!response.ok) {
      throw new Error(`Contacts upsert failed: ${response.status} ${await response.text()}`);
    }

    const rows = await response.json();
    rows.forEach((row) => {
      const key = buildMatchKey(row.normalized_name, row.country, row.city);
      if (key) {
        contactIdByKey.set(key, row.id);
      }
    });
  }

  const sourceRows = [];

  contacts.forEach((contact) => {
    const key = buildMatchKey(contact.full_name, contact.country, contact.city);
    const contactId = key ? contactIdByKey.get(key) : null;
    if (!contactId) {
      return;
    }

    contact.sources.forEach((source) => {
      sourceRows.push({
        contact_id: contactId,
        source: source.source,
        source_key: source.source_key,
        restaurant_name: source.restaurant_name ?? null,
        award: source.award ?? null,
        wine_role: source.wine_role ?? null,
        profile_url: source.profile_url ?? null,
        raw_data: source.raw_data ?? null,
      });
    });
  });

  for (const pack of chunk(sourceRows, 1000)) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/contact_sources?on_conflict=source,source_key`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(pack),
      },
    );

    if (!response.ok) {
      throw new Error(`Source upsert failed: ${response.status} ${await response.text()}`);
    }
  }

  return {
    contactsUpserted: contactsPayload.length,
    sourceRowsUpserted: sourceRows.length,
  };
}

async function main() {
  const guildPath = getArg('--guildsomm');
  const restaurantsPath = getArg('--restaurants', 'src/data/restaurants.json');
  const outputPath = getArg('--out', 'tmp/contacts-merged-preview.json');
  const apply = hasFlag('--apply');

  if (!guildPath) {
    console.error('Usage: node scripts/import-contacts.mjs --guildsomm <file.csv> [--apply]');
    process.exit(1);
  }

  const restaurantsRaw = fs.readFileSync(path.resolve(restaurantsPath), 'utf8');
  const restaurants = JSON.parse(restaurantsRaw);

  const guildCsv = fs.readFileSync(path.resolve(guildPath), 'utf8');
  const guildRows = parseGuildsommCsv(guildCsv);

  const wineContacts = buildWineAwardContacts(restaurants);
  const guildContacts = guildRows
    .map((row) => buildGuildContact(row))
    .filter((contact) => contact.normalized_name);

  const merged = mergeContacts(wineContacts, guildContacts);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    path.resolve(outputPath),
    JSON.stringify(
      {
        summary: {
          restaurants: restaurants.length,
          wineContacts: wineContacts.length,
          guildRows: guildRows.length,
          guildContacts: guildContacts.length,
          mergedContacts: merged.contacts.length,
          matched: merged.matched,
          unmatched: merged.unmatched,
        },
        contacts: merged.contacts,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('Import preview generated:', outputPath);
  console.log({
    restaurants: restaurants.length,
    wineContacts: wineContacts.length,
    guildRows: guildRows.length,
    guildContacts: guildContacts.length,
    mergedContacts: merged.contacts.length,
    matched: merged.matched,
    unmatched: merged.unmatched,
  });

  if (apply) {
    const result = await upsertSupabase(merged.contacts);
    console.log('Supabase upsert completed:', result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
