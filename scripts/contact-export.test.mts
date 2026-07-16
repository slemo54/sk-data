import assert from 'node:assert/strict';
import test from 'node:test';
import { contactsToCsv } from '../src/lib/contactExport.ts';

const baseContact = {
  id: '1',
  full_name: 'Mario Rossi',
  first_name: 'Mario',
  last_name: 'Rossi',
  normalized_name: 'mario rossi',
  city: 'Verona',
  country: 'Italia',
  email: 'mario@example.com',
  instagram_url: null,
  linkedin_url: 'https://linkedin.com/in/mario',
  employer: 'Azienda; Vini',
  title: 'Buyer',
  occupation: 'Wine buyer',
  cms_cert: null,
  review_status: 'seen',
  next_action: 'pronto_da_contattare',
  approval: true,
  contacted: false,
  notes: 'Riga 1\nRiga "2"',
  status: 'reviewed',
  assigned_to: 'operatore@example.com',
  claimed_at: null,
  reviewed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  contact_sources: [
    {
      source: 'via_db',
      source_key: 'via_db:verona-2026',
      wine_role: 'IWA',
      raw_data: { course: 'VERONA 2026' },
    },
    {
      source: 'linkedin_sk',
      source_key: 'linkedin_sk:mario-rossi',
      raw_data: { note: 'A;B' },
    },
  ],
};

test('genera CSV Excel con BOM, separatore e escaping corretti', () => {
  const csv = contactsToCsv([baseContact]);

  assert.ok(csv.startsWith('\uFEFFid;full_name;'));
  assert.ok(csv.includes('"Azienda; Vini"'));
  assert.ok(csv.includes('"Riga 1\nRiga ""2"""'));
  assert.ok(csv.includes('via_db | linkedin_sk'));
  assert.ok(csv.includes('via_db:verona-2026 | linkedin_sk:mario-rossi'));
  assert.ok(csv.includes('""course"":""VERONA 2026""'));
  assert.ok(csv.includes('\r\n'));
});
