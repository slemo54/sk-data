import type {
  Contact,
  ContactPatch,
  ContactSource,
  ContactsFilters,
  ContactsResponse,
  ContactSort,
  DashboardKpi,
  Pagination,
  ReviewStatus,
} from '@/types/contact';
import { sbFetch } from '@/lib/supabase';

function escapeLike(value: string): string {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function applyFilters(contacts: Contact[], filters: ContactsFilters): Contact[] {
  return contacts.filter((contact) => {
    if (filters.query) {
      const query = filters.query.toLowerCase();
      const haystack = [
        contact.full_name,
        contact.email,
        contact.instagram_url,
        contact.linkedin_url,
        contact.employer,
        contact.title,
        contact.occupation,
        contact.city,
        contact.country,
        contact.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (filters.country && filters.country !== 'all' && contact.country !== filters.country) {
      return false;
    }

    if (filters.status && filters.status !== 'all' && contact.status !== filters.status) {
      return false;
    }

    if (filters.reviewStatus && filters.reviewStatus !== 'all' && contact.review_status !== filters.reviewStatus) {
      return false;
    }

    if (filters.nextAction && filters.nextAction !== 'all' && contact.next_action !== filters.nextAction) {
      return false;
    }

    if (filters.approved === true && !contact.approval) {
      return false;
    }

    if (filters.approved === false && contact.approval) {
      return false;
    }

    if (filters.contacted === true && !contact.contacted) {
      return false;
    }

    if (filters.contacted === false && contact.contacted) {
      return false;
    }

    if (filters.hasInstagram && !contact.instagram_url) {
      return false;
    }

    if (filters.hasLinkedin && !contact.linkedin_url) {
      return false;
    }

    if (filters.hasEmail && !contact.email) {
      return false;
    }

    if (filters.unassigned && contact.assigned_to) {
      return false;
    }

    if (filters.assignedToMe && filters.userId && contact.assigned_to !== filters.userId) {
      return false;
    }

    return true;
  });
}

function applySort(contacts: Contact[], sort: ContactSort): Contact[] {
  const multiplier = sort.direction === 'asc' ? 1 : -1;

  return [...contacts].sort((a, b) => {
    const left = (a[sort.field] ?? '').toString().toLowerCase();
    const right = (b[sort.field] ?? '').toString().toLowerCase();

    if (left < right) {
      return -1 * multiplier;
    }

    if (left > right) {
      return 1 * multiplier;
    }

    return 0;
  });
}

export async function fetchContacts(
  filters: ContactsFilters,
  pagination: Pagination,
  sort: ContactSort,
): Promise<ContactsResponse> {
  const sourceFilter = filters.source && filters.source !== 'all' ? filters.source : null;
  const queryFilter = filters.query
    ? `&or=(${[
        `full_name.ilike.*${encodeURIComponent(escapeLike(filters.query))}*`,
        `email.ilike.*${encodeURIComponent(escapeLike(filters.query))}*`,
        `instagram_url.ilike.*${encodeURIComponent(escapeLike(filters.query))}*`,
        `linkedin_url.ilike.*${encodeURIComponent(escapeLike(filters.query))}*`,
        `employer.ilike.*${encodeURIComponent(escapeLike(filters.query))}*`,
      ].join(',')})`
    : '';

  const countryFilter = filters.country && filters.country !== 'all' ? `&country=eq.${encodeURIComponent(filters.country)}` : '';
  const statusFilter = filters.status && filters.status !== 'all' ? `&status=eq.${filters.status}` : '';

  // Loop to fetch all rows in chunks of 1000 because of Supabase max_rows limit
  let allRows: Contact[] = [];
  let offsetFetch = 0;
  const CHUNK_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const chunk = await sbFetch<Contact[]>(
      `/rest/v1/contacts?select=*${queryFilter}${countryFilter}${statusFilter}&order=${sort.field}.${sort.direction}&limit=${CHUNK_SIZE}&offset=${offsetFetch}`,
    );
    
    allRows = [...allRows, ...chunk];
    offsetFetch += CHUNK_SIZE;
    
    if (chunk.length < CHUNK_SIZE || allRows.length >= 20000) {
      hasMore = false;
    }
  }

  let filtered = applyFilters(allRows, filters);
  if (sourceFilter) {
    // Also fetch sources in chunks if necessary (for simplicity, we use a large limit here or chunking if it fails)
    const sourceRows = await sbFetch<Array<{ contact_id: string }>>(
      `/rest/v1/contact_sources?select=contact_id&source=eq.${sourceFilter}&limit=10000`,
    );
    const allowedIds = new Set(sourceRows.map((row) => row.contact_id));
    filtered = filtered.filter((row) => allowedIds.has(row.id));
  }

  const sorted = applySort(filtered, sort);

  const offset = (pagination.page - 1) * pagination.pageSize;
  const pageRows = sorted.slice(offset, offset + pagination.pageSize);

  return {
    rows: pageRows,
    total: sorted.length,
  };
}

export async function claimContacts(count: number, userId: string): Promise<Contact[]> {
  return sbFetch<Contact[]>('/rest/v1/rpc/claim_contacts', {
    method: 'POST',
    body: JSON.stringify({ claim_count: count, claim_user: userId }),
  });
}

export async function updateContact(contactId: string, patch: ContactPatch): Promise<Contact> {
  const rows = await sbFetch<Contact[]>(`/rest/v1/contacts?id=eq.${contactId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!rows.length) {
    throw new Error('Contact not found after update.');
  }

  return rows[0];
}

export async function setContactStatus(contactId: string, status: ReviewStatus): Promise<Contact> {
  const patch: Record<string, string | null> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'reviewed') {
    patch.reviewed_at = new Date().toISOString();
  }

  const rows = await sbFetch<Contact[]>(`/rest/v1/contacts?id=eq.${contactId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });

  if (!rows.length) {
    throw new Error('Contact not found after status update.');
  }

  return rows[0];
}

export async function toggleApproval(contactId: string, value: boolean): Promise<Contact> {
  return updateContact(contactId, { approval: value });
}

export async function toggleContacted(contactId: string, value: boolean): Promise<Contact> {
  return updateContact(contactId, { contacted: value });
}

export async function addNote(contactId: string, note: string): Promise<Contact> {
  return updateContact(contactId, { notes: note.trim() || null });
}

export async function fetchContactSources(contactId: string): Promise<ContactSource[]> {
  return sbFetch<ContactSource[]>(
    `/rest/v1/contact_sources?select=*&contact_id=eq.${contactId}&order=created_at.asc`,
  );
}

export function computeDashboardKpi(contacts: Contact[]): DashboardKpi {
  const pendingReview = contacts.filter((c) => c.review_status === 'unseen').length;
  const readyToContact = contacts.filter((c) => c.next_action === 'pronto_da_contattare').length;
  const contactedCount = contacts.filter((c) => c.contacted).length;

  return {
    total: contacts.length,
    pendingReview,
    readyToContact,
    contacted: contactedCount,
  };
}

export async function fetchDashboardKpi(): Promise<DashboardKpi> {
  let allRows: any[] = [];
  let offsetFetch = 0;
  const CHUNK_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const chunk = await sbFetch<any[]>(
      `/rest/v1/contacts?select=review_status,next_action,contacted&limit=${CHUNK_SIZE}&offset=${offsetFetch}`,
    );
    allRows = [...allRows, ...chunk];
    offsetFetch += CHUNK_SIZE;
    if (chunk.length < CHUNK_SIZE || allRows.length >= 20000) {
      hasMore = false;
    }
  }

  return computeDashboardKpi(allRows as Contact[]);
}
