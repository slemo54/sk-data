export interface CsvContactSource {
  id?: string;
  contact_id?: string;
  source?: string | null;
  source_key?: string | null;
  restaurant_name?: string | null;
  award?: string | null;
  wine_role?: string | null;
  profile_url?: string | null;
  raw_data?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface CsvContact {
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
  review_status: string;
  next_action: string | null;
  approval: boolean;
  contacted: boolean;
  notes: string | null;
  status: string;
  assigned_to: string | null;
  claimed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  contact_sources?: CsvContactSource[];
}

const CONTACT_COLUMNS: Array<keyof Omit<CsvContact, 'contact_sources'>> = [
  'id',
  'full_name',
  'first_name',
  'last_name',
  'normalized_name',
  'city',
  'country',
  'email',
  'instagram_url',
  'linkedin_url',
  'employer',
  'title',
  'occupation',
  'cms_cert',
  'review_status',
  'next_action',
  'approval',
  'contacted',
  'notes',
  'status',
  'assigned_to',
  'claimed_at',
  'reviewed_at',
  'created_at',
  'updated_at',
];

const SOURCE_COLUMNS = [
  'source_names',
  'source_keys',
  'source_restaurants',
  'source_awards',
  'source_roles',
  'source_profile_urls',
  'sources_json',
] as const;

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function joinSourceValues(
  sources: CsvContactSource[],
  field: keyof CsvContactSource,
): string {
  return sources
    .map((source) => source[field])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' | ');
}

export function contactsToCsv(contacts: CsvContact[]): string {
  const header = [...CONTACT_COLUMNS, ...SOURCE_COLUMNS].join(';');
  const rows = contacts.map((contact) => {
    const sources = contact.contact_sources ?? [];
    const values: unknown[] = [
      ...CONTACT_COLUMNS.map((column) => contact[column]),
      joinSourceValues(sources, 'source'),
      joinSourceValues(sources, 'source_key'),
      joinSourceValues(sources, 'restaurant_name'),
      joinSourceValues(sources, 'award'),
      joinSourceValues(sources, 'wine_role'),
      joinSourceValues(sources, 'profile_url'),
      JSON.stringify(sources),
    ];
    return values.map(csvValue).join(';');
  });

  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function downloadContactsCsv(
  contacts: CsvContact[],
  date = new Date(),
): void {
  const csv = contactsToCsv(contacts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const datePart = date.toISOString().slice(0, 10);

  link.href = href;
  link.download = `sk-database-contatti-${datePart}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
