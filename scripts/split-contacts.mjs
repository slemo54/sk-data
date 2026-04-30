#!/usr/bin/env node
/**
 * Script per separare contatti con nomi multipli nella stessa riga.
 * Esempio: "Aaron Watts, Polina Jensen" → due contatti separati.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx VITE_SUPABASE_URL=xxx node scripts/split-contacts.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function splitNames(fullName) {
  if (!fullName) return [];
  // Separa per virgola, " and ", " & ", " / "
  const separators = [',', ' and ', ' \u0026 ', ' / '];
  let names = [fullName];
  for (const sep of separators) {
    names = names.flatMap((n) => n.split(sep).map((s) => s.trim()));
  }
  return names.filter((n) => n.length > 0);
}

async function fetchAllContacts() {
  const all = [];
  let offset = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .range(offset, offset + chunk - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < chunk) break;
    offset += chunk;
  }
  return all;
}

async function main() {
  console.log('Fetching all contacts...');
  const contacts = await fetchAllContacts();
  console.log(`Total contacts: ${contacts.length}`);

  const toSplit = contacts.filter((c) => {
    const names = splitNames(c.full_name);
    return names.length > 1;
  });

  console.log(`Contacts with multiple names: ${toSplit.length}`);

  if (toSplit.length === 0) {
    console.log('Nothing to split.');
    return;
  }

  for (const contact of toSplit) {
    const names = splitNames(contact.full_name);
    console.log(`\nSplitting "${contact.full_name}" into ${names.length} contacts...`);

    // Fetch sources for original contact
    const { data: sources } = await supabase
      .from('contact_sources')
      .select('*')
      .eq('contact_id', contact.id);

    for (const name of names) {
      const { data: newContact, error: insertErr } = await supabase
        .from('contacts')
        .insert({
          full_name: name,
          first_name: null,
          last_name: null,
          normalized_name: name.toLowerCase().replace(/\s+/g, ' ').trim(),
          email: contact.email,
          instagram_url: contact.instagram_url,
          linkedin_url: contact.linkedin_url,
          employer: contact.employer,
          title: contact.title,
          occupation: contact.occupation,
          city: contact.city,
          country: contact.country,
          notes: contact.notes,
          status: contact.status,
          review_status: contact.review_status,
          next_action: contact.next_action,
          approval: contact.approval,
          contacted: contact.contacted,
          assigned_to: contact.assigned_to,
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`  Failed to create contact for "${name}":`, insertErr.message);
        continue;
      }

      console.log(`  Created: "${name}" (id: ${newContact.id})`);

      // Copy sources
      if (sources && sources.length > 0) {
        const sourceInserts = sources.map((s) => ({
          contact_id: newContact.id,
          source: s.source,
          source_key: s.source_key,
          source_url: s.source_url,
          raw_data: s.raw_data,
        }));
        const { error: sourceErr } = await supabase
          .from('contact_sources')
          .insert(sourceInserts);
        if (sourceErr) {
          console.error(`  Failed to copy sources for "${name}":`, sourceErr.message);
        }
      }
    }

    // Delete original contact (cascade will delete sources)
    const { error: deleteErr } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contact.id);

    if (deleteErr) {
      console.error(`  Failed to delete original contact ${contact.id}:`, deleteErr.message);
    } else {
      console.log(`  Deleted original contact ${contact.id}`);
    }
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
