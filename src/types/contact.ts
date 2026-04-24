export type ReviewStatus = 'todo' | 'in_progress' | 'reviewed';

export type ContactSourceName = 'wine_awards' | 'guildsomm';

export interface Contact {
  id: string;
  full_name: string;
  normalized_name: string;
  city: string | null;
  country: string | null;
  email: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  employer: string | null;
  title: string | null;
  occupation: string | null;
  cms_cert: string | null;
  status: ReviewStatus;
  assigned_to: string | null;
  claimed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSource {
  id: string;
  contact_id: string;
  source: ContactSourceName;
  source_key: string;
  restaurant_name: string | null;
  award: string | null;
  wine_role: string | null;
  profile_url: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ContactsFilters {
  query?: string;
  country?: string;
  source?: ContactSourceName | 'all';
  hasInstagram?: boolean;
  hasLinkedin?: boolean;
  hasEmail?: boolean;
  status?: ReviewStatus | 'all';
  assignedToMe?: boolean;
  unassigned?: boolean;
  userId?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export type ContactSortField =
  | 'full_name'
  | 'country'
  | 'city'
  | 'employer'
  | 'status'
  | 'assigned_to'
  | 'updated_at';

export interface ContactSort {
  field: ContactSortField;
  direction: 'asc' | 'desc';
}

export interface ContactsResponse {
  rows: Contact[];
  total: number;
}

export interface ContactPatch {
  email?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  employer?: string | null;
  title?: string | null;
  occupation?: string | null;
}

export interface DashboardKpi {
  total: number;
  withSocial: number;
  withEmail: number;
  inReview: number;
  reviewed: number;
  unassigned: number;
}
