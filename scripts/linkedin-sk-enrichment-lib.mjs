import { parse } from 'csv-parse/sync';

const ENRICHMENT_FIELDS = ['city', 'country', 'occupation', 'employer'];
const EMPTY_VALUES = new Set(['', 'no data', 'n/a', 'na', 'null', 'undefined', '-']);

export function normalizeLinkedinUrl(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';

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

export function isMeaningfulValue(value) {
  const normalized = (value ?? '').toString().trim().toLowerCase();
  return !EMPTY_VALUES.has(normalized);
}

export function normalizeCell(value) {
  const trimmed = (value ?? '').toString().trim();
  return isMeaningfulValue(trimmed) ? trimmed : null;
}

export function buildContactPatch(row) {
  const patch = {};

  for (const field of ENRICHMENT_FIELDS) {
    const value = normalizeCell(row[field] ?? row[field.toUpperCase()]);
    if (value) {
      patch[field] = value;
    }
  }

  return patch;
}

function escapeCsvValue(value) {
  const text = (value ?? '').toString();
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(rows, preferredHeaders = []) {
  const headers = preferredHeaders.length
    ? preferredHeaders
    : Object.keys(rows[0] ?? {});

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
}

export function parseEnrichmentCsv(csvText) {
  return parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
}

