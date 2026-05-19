export type ReviewStatus = 'todo' | 'in_progress' | 'reviewed';

export type ReviewVisibility = 'seen' | 'unseen';

export type NextAction =
  | 'pronto_da_contattare'
  | 'da_approvare'
  | 'follow_up'
  | 'contattato'
  | 'da_verificare'
  | 'chiuso';

export type ContactSourceName = 'wine_awards' | 'guildsomm' | 'linkedin_sk' | 'via_db';

export interface Contact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
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
  review_status: ReviewVisibility;
  next_action: NextAction | null;
  approval: boolean;
  contacted: boolean;
  notes: string | null;
  status: ReviewStatus;
  assigned_to: string | null;
  claimed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  contact_sources?: Pick<ContactSource, 'source' | 'source_key' | 'raw_data'>[];
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
  city?: string;
  location?: string;
  source?: ContactSourceName | 'all';
  viaCourse?: string;
  hasInstagram?: boolean;
  hasLinkedin?: boolean;
  hasEmail?: boolean;
  status?: ReviewStatus | 'all';
  reviewStatus?: ReviewVisibility | 'all';
  nextAction?: NextAction | 'all';
  approved?: boolean;
  contacted?: boolean;
  assignedToMe?: boolean;
  unassigned?: boolean;
  assignedToOthers?: boolean;
  notReady?: boolean;
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
  | 'next_action'
  | 'review_status'
  | 'approval'
  | 'contacted'
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
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  employer?: string | null;
  title?: string | null;
  occupation?: string | null;
  review_status?: ReviewVisibility;
  next_action?: NextAction | null;
  approval?: boolean;
  contacted?: boolean;
  notes?: string | null;
  status?: ReviewStatus;
  city?: string | null;
  country?: string | null;
}

export interface ContactCreate {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  employer?: string | null;
  title?: string | null;
  occupation?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
}

export interface DashboardKpi {
  total: number;
  pendingReview: number;
  readyToContact: number;
  contacted: number;
  approved: number;
}
