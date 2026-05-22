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
  ViaSourcePatch,
} from '@/types/contact';
import { sbFetch, sbFetchWithCount } from '@/lib/supabase';
import { getAccessToken } from '@/lib/auth';

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
    params.push(`or=(next_action.neq.pronto_da_contattare,next_action.is.null)`);
  }

  return params.length ? `&${params.join('&')}` : '';
}

function buildSourceFilter(filters: ContactsFilters): string {
  const source = filters.source;
  if (!source || source === 'all') return '';

  const parts: string[] = [];

  if (source === 'via_db') {
    parts.push(`contact_sources.source_key=like.${encodeURIComponent('via_db:*')}`);
    if (filters.viaCourse && filters.viaCourse !== 'all') {
      parts.push(`contact_sources.wine_role=eq.${encodeURIComponent(filters.viaCourse)}`);
    }
    return `&${parts.join('&')}`;
  }

  parts.push(`contact_sources.source=eq.${encodeURIComponent(source)}`);

  if (source === 'wine_awards') {
    parts.push(`contact_sources.source_key=not.like.${encodeURIComponent('via_db:*')}`);
  }

  return `&${parts.join('&')}`;
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
    ? '*,contact_sources!inner(source,source_key,raw_data)'
    : '*,contact_sources(source,source_key,raw_data)';

  const filterParams = buildFilters(filters);
  const sourceFilter = buildSourceFilter(filters);

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

async function deleteContactViaApi(contactId: string): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;

  const response = await fetch('/api/delete-contact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactId }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  if (response.status === 404 && !isJson) {
    return null;
  }

  const body = isJson ? await response.json() as { id?: string; error?: string } : null;
  if (!response.ok) {
    throw new Error(body?.error || `Eliminazione fallita (${response.status})`);
  }
  if (!body?.id) {
    throw new Error('Eliminazione fallita: risposta server non valida.');
  }

  return body.id;
}

export async function deleteContact(contactId: string): Promise<string> {
  const apiDeletedId = await deleteContactViaApi(contactId);
  if (apiDeletedId) return apiDeletedId;

  const rows = await sbFetch<Array<{ id: string }>>(`/rest/v1/contacts?id=eq.${contactId}&select=id`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=representation',
    },
  });

  if (!rows.length) {
    throw new Error('Contatto non eliminato: non è assegnato a te o non hai i permessi.');
  }

  const stillPresent = await sbFetch<Array<{ id: string }>>(
    `/rest/v1/contacts?select=id&id=eq.${contactId}&limit=1`,
  );

  if (stillPresent.length) {
    throw new Error('Contatto non eliminato: il database lo restituisce ancora dopo la cancellazione.');
  }

  return rows[0].id;
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

export async function upsertViaSource(contactId: string, patch: ViaSourcePatch): Promise<ContactSource> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sessione mancante.');
  }

  const response = await fetch('/api/upsert-via-source', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactId, ...patch }),
  });

  const body = await response.json() as { source?: ContactSource; error?: string };
  if (!response.ok || !body.source) {
    throw new Error(body.error || `Aggiornamento VIA fallito (${response.status})`);
  }

  return body.source;
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

export async function fetchViaCourseClasses(): Promise<string[]> {
  const rows = await sbFetch<Array<{ wine_role: string | null }>>(
    `/rest/v1/contact_sources?select=wine_role&source_key=like.${encodeURIComponent('via_db:*')}&wine_role=not.is.null`,
  );
  const set = new Set<string>();
  rows.forEach((row) => {
    const course = row.wine_role?.trim();
    if (course) set.add(course);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Operator approval
export interface PendingOperator {
  id: string;
  email: string;
  auth_user_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export type OperatorApprovalStatus = PendingOperator['status'] | 'admin' | 'missing' | 'error';

export async function createPendingOperator(email: string): Promise<void> {
  await sbFetch('/rest/v1/pending_operators?on_conflict=email', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({ email, status: 'pending' }),
  });
}

export async function getOperatorApprovalStatus(email: string): Promise<OperatorApprovalStatus> {
  // Admin sempre approvato
  if (email === 'kim@mammajumboshrimp.com') return 'admin';

  try {
    // Cerca qualsiasi record per questa email
    const rows = await sbFetch<Array<PendingOperator>>(
      `/rest/v1/pending_operators?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
    );

    return rows[0]?.status ?? 'missing';
  } catch {
    return 'error';
  }
}

export async function ensurePendingOperatorRequest(email: string): Promise<void> {
  const status = await getOperatorApprovalStatus(email);
  if (status === 'missing') {
    await createPendingOperator(email);
  }
}

export async function checkOperatorApproved(email: string): Promise<boolean> {
  const status = await getOperatorApprovalStatus(email);
  if (status === 'admin' || status === 'approved') return true;
  if (status === 'missing') {
    try {
      await createPendingOperator(email);
    } catch {
      // L'accesso resta bloccato, ma evitiamo di rompere il rendering.
    }
  }
  if (status === 'error') {
    return false;
  }
  return false;
}

export async function fetchPendingOperators(): Promise<PendingOperator[]> {
  return sbFetch<PendingOperator[]>('/rest/v1/pending_operators?select=*&status=eq.pending&order=created_at.desc');
}

export async function approveOperator(id: string): Promise<void> {
  await sbFetch(`/rest/v1/pending_operators?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' }),
  });
}

export async function rejectOperator(id: string): Promise<void> {
  await sbFetch(`/rest/v1/pending_operators?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });
}
