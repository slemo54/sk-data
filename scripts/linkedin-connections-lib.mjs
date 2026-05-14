import { parse } from 'csv-parse/sync';

export function normalizeName(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cleanCell(value) {
  const text = (value ?? '').toString().trim();
  if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'no data') {
    return null;
  }
  return text;
}

export function normalizeLinkedinUrl(value) {
  const raw = cleanCell(value);
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return withProtocol.replace(/\/$/, '');
  }
}

export function parseConnectionsCsv(csvText) {
  const records = parse(csvText, {
    bom: true,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: true,
  });

  const headerIndex = records.findIndex((row) => row.includes('First Name') && row.includes('Last Name'));
  if (headerIndex < 0) {
    throw new Error('Connections CSV header not found.');
  }

  const headers = records[headerIndex];
  return records.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cleanCell(cell)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function sourceSafe(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildConnectionContact(row) {
  const firstName = cleanCell(row['First Name']);
  const lastName = cleanCell(row['Last Name']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const linkedinUrl = normalizeLinkedinUrl(row.URL);
  const position = cleanCell(row.Position);
  const employer = cleanCell(row.Company);

  if (!fullName || !linkedinUrl) {
    return null;
  }

  const contact = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    normalized_name: normalizeName(fullName),
    city: 'no data',
    country: 'no data',
    email: cleanCell(row['Email Address']),
    instagram_url: null,
    linkedin_url: linkedinUrl,
    employer: employer ?? 'no data',
    title: position ?? 'no data',
    occupation: position ?? 'no data',
    status: 'reviewed',
    review_status: 'unseen',
    next_action: 'da_verificare',
    approval: false,
    contacted: false,
    notes: 'LinkedIn connection export. City/country require enrichment.',
  };

  return {
    contact,
    source: {
      source: 'linkedin_sk',
      source_key: `linkedin_connections:${sourceSafe(linkedinUrl)}`,
      restaurant_name: null,
      award: null,
      wine_role: 'LinkedIn connection',
      profile_url: linkedinUrl,
      raw_data: {
        source: 'linkedin_connections',
        imported_from: 'Connections.csv',
        connected_on: cleanCell(row['Connected On']),
        company: employer,
        position,
        missing_fields: ['city', 'country'],
        row,
      },
    },
  };
}
