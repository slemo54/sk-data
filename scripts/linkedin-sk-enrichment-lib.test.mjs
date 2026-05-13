import assert from 'node:assert/strict';
import {
  buildContactPatch,
  normalizeLinkedinUrl,
  toCsv,
} from './linkedin-sk-enrichment-lib.mjs';

assert.equal(normalizeLinkedinUrl('www.linkedin.com/in/example/'), 'https://www.linkedin.com/in/example');

assert.deepEqual(
  buildContactPatch({
    city: 'Verona',
    country: 'Italy',
    occupation: 'Wine educator',
    employer: 'Mamma Jumbo Shrimp',
  }),
  {
    city: 'Verona',
    country: 'Italy',
    occupation: 'Wine educator',
    employer: 'Mamma Jumbo Shrimp',
  },
);

assert.deepEqual(
  buildContactPatch({
    city: 'no data',
    country: '',
    occupation: '  ',
    employer: null,
  }),
  {},
);

assert.equal(
  toCsv([{ full_name: 'A, B', city: 'Verona', country: 'Italy' }]).trim(),
  'full_name,city,country\n\"A, B\",Verona,Italy',
);

console.log('linkedin-sk-enrichment-lib tests passed');
