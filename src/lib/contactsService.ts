import type {
  Contact,
  ContactCreate,
  ContactPatch,
  ContactSource,
  ContactsFilters,
  ContactsResponse,
  ContactSort,
  DashboardKpi,
  Pagination,
  ReviewStatus,
} from '@/types/contact';
import { sbFetch, sbFetchWithCount } from '@/lib/supabase';

function escapeLike(value: string): string {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function buildSearchFilter(query: string): string {
  const words = query.split(/\s+/).filter(Boolean);
  if (!words.length) return '';

  const searchableFields = [
    'full_name',
    'first_name',
    'last_name',
    'email',
    'instagram_url',
    'linkedin_url',
    'employer',
    'title',
    'occupation',
    'city',
    'country',
    'notes',
  ];

  const wordConditions = words.map((word) => {
    const ors = searchableFields
      .map((f) => `${f}.ilike.*${encodeURIComponent(escapeLike(word))}*`)
      .join(',');
    return `or(${ors})`;
  });

  if (wordConditions.length === 1) {
    return `&or=(${wordConditions[0].slice(3, -1)})`;
  }
  return `&and=(${wordConditions.join(',')})`;
}

function buildFilters(filters: ContactsFilters): string {
  const params: string[] = [];

  if (filters.query) {
    params.push(buildSearchFilter(filters.query).replace(/^&/, ''));
  }

  if (filters.country && filters.country !== 'all') {
    params.push(`country=eq.${encodeURIComponent(filters.country)}`);
  }

  if (filters.city && filters.city !== 'all') {
    params.push(`city=eq.${encodeURIComponent(filters.city)}`);
  }

  if (filters.location) {
    const loc = encodeURIComponent(escapeLike(filters.location));
    params.push(`or=(city.ilike.*${loc}*,country.ilike.*${loc}*)`);
  }

  if (filters.status && filters.status !== 'all') {
    params.push(`status=eq.${filters.status}`);
  }

  if (filters.reviewStatus && filters.reviewStatus !== 'all') {
    params.push(`review_status=eq.${filters.reviewStatus}`);
  }

  if (filters.nextAction && filters.nextAction !== 'all') {
    params.push(`next_action=eq.${filters.nextAction}`);
    if (filters.nextAction === 'pronto_da_contattare') {
      params.push(`or=(instagram_url.not.is.null,linkedin_url.not.is.null)`);
    }
  }

  if (filters.approved === true) {
    params.push('approval=eq.true');
  } else if (filters.approved === false) {
    params.push('approval=eq.false');
  }

  if (filters.contacted === true) {
    params.push('contacted=eq.true');
  } else if (filters.contacted === false) {
    params.push('contacted=eq.false');
  }

  if (filters.hasInstagram) {
    params.push('instagram_url=not.is.null');
  }

  if (filters.hasLinkedin) {
    params.push('linkedin_url=not.is.null');
  }

  if (filters.hasEmail) {
    params.push('email=not.is.null');
  }

  if (filters.unassigned) {
    params.push('assigned_to=is.null');
  }

  if (filters.assignedToMe && filters.userId) {
    params.push(`assigned_to=eq.${encodeURIComponent(filters.userId)}`);
  }

  if (filters.assignedToOthers && filters.userId) {
    params.push(`and=(assigned_to.not.eq.${encodeURIComponent(filters.userId)},assigned_to.not.is.null)`);
  }

  if (filters.notReady) {
    params.push(`not.and=(next_action.eq.pronto_da_contattare,assigned_to.is.null)`);
  }

  return params.length ? `&${params.join('&')}` : '';
}

export async function fetchContacts(
  filters: ContactsFilters,
  pagination: Pagination,
  sort: ContactSort,
  signal?: AbortSignal,
): Promise<ContactsResponse> {
  const hasSourceFilter = filters.source && filters.source !== 'all';

  // Per filtro su source usiamo embedded resource con !inner
  const selectClause = hasSourceFilter
    ? '*,contact_sources!inner(source)'
    : '*';

  const filterParams = buildFilters(filters);
  const sourceFilter = hasSourceFilter
    ? `&contact_sources.source=eq.${encodeURIComponent(filters.source!)}`
    : '';

  const offset = (pagination.page - 1) * pagination.pageSize;
  const order = `order=${sort.field}.${sort.direction}`;

  const { data: rows, count: total } = await sbFetchWithCount<Contact[]>(
    `/rest/v1/contacts?select=${selectClause}${filterParams}${sourceFilter}&${order}&limit=${pagination.pageSize}&offset=${offset}`,
    { signal },
  );

  return {
    rows,
    total,
  };
}

export async function claimContacts(count: number, userId: string): Promise<Contact[]> {
  return sbFetch<Contact[]>('/rest/v1/rpc/claim_contacts', {
    method: 'POST',
    body: JSON.stringify({ claim_count: count, claim_user: userId }),
  });
}

export async function claimSingleContact(contactId: string, userId: string): Promise<Contact> {
  const rows = await sbFetch<Contact[]>('/rest/v1/rpc/claim_single_contact', {
    method: 'POST',
    body: JSON.stringify({ contact_id: contactId, claim_user: userId }),
  });
  return rows[0];
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

export async function deleteContact(contactId: string): Promise<void> {
  await sbFetch(`/rest/v1/contacts?id=eq.${contactId}`, {
    method: 'DELETE',
  });
}

export async function createContact(data: ContactCreate): Promise<Contact> {
  const rows = await sbFetch<Contact[]>('/rest/v1/contacts', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });

  if (!rows.length) {
    throw new Error('Contact not created.');
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

export async function releaseContact(contactId: string): Promise<void> {
  await sbFetch('/rest/v1/rpc/release_contact', {
    method: 'POST',
    body: JSON.stringify({ p_contact_id: contactId }),
  });
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
  const readyToContact = contacts.filter(
    (c) => c.next_action === 'pronto_da_contattare' && (c.instagram_url || c.linkedin_url),
  ).length;
  const contactedCount = contacts.filter((c) => c.contacted).length;
  const approvedCount = contacts.filter((c) => c.approval).length;

  return {
    total: contacts.length,
    pendingReview,
    readyToContact,
    contacted: contactedCount,
    approved: approvedCount,
  };
}

export async function fetchDashboardKpi(): Promise<DashboardKpi> {
  type KpiRow = {
    total: number;
    pending_review: number;
    ready_to_contact: number;
    contacted: number;
    approved: number;
  };
  const [row] = await sbFetch<Array<KpiRow>>(
    '/rest/v1/rpc/get_dashboard_kpi',
  );
  return {
    total: Number(row.total),
    pendingReview: Number(row.pending_review),
    readyToContact: Number(row.ready_to_contact),
    contacted: Number(row.contacted),
    approved: Number(row.approved),
  };
}

export async function fetchCountries(): Promise<string[]> {
  const rows = await sbFetch<Array<{ country: string | null }>>(
    '/rest/v1/contacts?select=country&country=not.is.null',
  );
  const set = new Set<string>();
  rows.forEach((r) => {
    if (r.country) set.add(r.country);
  });
  return [...set].sort();
}

export async function fetchCities(): Promise<string[]> {
  const rows = await sbFetch<Array<{ city: string | null }>>(
    '/rest/v1/contacts?select=city&city=not.is.null',
  );
  const set = new Set<string>();
  rows.forEach((r) => {
    if (r.city) set.add(r.city);
  });
  return [...set].sort();
}
