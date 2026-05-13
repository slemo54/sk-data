import assert from 'node:assert/strict';
import {
  buildConnectionContact,
  normalizeLinkedinUrl,
  parseConnectionsCsv,
} from './linkedin-connections-lib.mjs';

const csv = `Notes:\nignored\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nSarah,\"Looper, DipWSET\",www.linkedin.com/in/sarah-looper,,Loopersomm LLC,CEO,21 Apr 2026\nLe Morette - Az. Agr. Valerio Zenato,undefined,https://www.linkedin.com/in/le-morette,,,\n`;

const rows = parseConnectionsCsv(csv);
assert.equal(rows.length, 2);
assert.equal(rows[0]['First Name'], 'Sarah');

assert.equal(normalizeLinkedinUrl('www.linkedin.com/in/example/'), 'https://www.linkedin.com/in/example');

assert.deepEqual(
  buildConnectionContact(rows[0]).contact,
  {
    full_name: 'Sarah Looper, DipWSET',
    first_name: 'Sarah',
    last_name: 'Looper, DipWSET',
    normalized_name: 'sarah looper dipwset',
    city: 'no data',
    country: 'no data',
    email: null,
    instagram_url: null,
    linkedin_url: 'https://www.linkedin.com/in/sarah-looper',
    employer: 'Loopersomm LLC',
    title: 'CEO',
    occupation: 'CEO',
    status: 'reviewed',
    review_status: 'unseen',
    next_action: 'pronto_da_contattare',
    approval: false,
    contacted: false,
    notes: 'LinkedIn connection export. City/country require enrichment.',
  },
);

assert.equal(buildConnectionContact(rows[1]).contact.full_name, 'Le Morette - Az. Agr. Valerio Zenato');

console.log('linkedin-connections-lib tests passed');
