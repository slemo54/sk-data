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

  const rows = await sbFetch<Contact[]>(
    `/rest/v1/contacts?select=*${queryFilter}${countryFilter}${statusFilter}&order=${sort.field}.${sort.direction}`,
  );

  let filtered = applyFilters(rows, filters);
  if (sourceFilter) {
    const sourceRows = await sbFetch<Array<{ contact_id: string }>>(
      `/rest/v1/contact_sources?select=contact_id&source=eq.${sourceFilter}`,
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

export async function fetchContactSources(contactId: string): Promise<ContactSource[]> {
  return sbFetch<ContactSource[]>(
    `/rest/v1/contact_sources?select=*&contact_id=eq.${contactId}&order=created_at.asc`,
  );
}

export function computeDashboardKpi(contacts: Contact[]): DashboardKpi {
  const withSocial = contacts.filter((c) => c.instagram_url || c.linkedin_url).length;
  const withEmail = contacts.filter((c) => c.email).length;
  const inReview = contacts.filter((c) => c.status === 'in_progress').length;
  const reviewed = contacts.filter((c) => c.status === 'reviewed').length;
  const unassigned = contacts.filter((c) => !c.assigned_to).length;

  return {
    total: contacts.length,
    withSocial,
    withEmail,
    inReview,
    reviewed,
    unassigned,
  };
}

export async function fetchDashboardKpi(): Promise<DashboardKpi> {
  const rows = await sbFetch<
    Array<Pick<Contact, 'email' | 'instagram_url' | 'linkedin_url' | 'status' | 'assigned_to'>>
  >('/rest/v1/contacts?select=email,instagram_url,linkedin_url,status,assigned_to');
  return computeDashboardKpi(rows as Contact[]);
}
