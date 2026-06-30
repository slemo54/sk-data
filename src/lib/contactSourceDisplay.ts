import type { Contact, ContactSource, ContactSourceName } from '@/types/contact';

const SOURCE_LABELS: Record<ContactSourceName, string> = {
  wine_awards: 'Wine Awards',
  guildsomm: 'GuildSomm',
  linkedin_sk: 'Da LinkedIn SK',
  via_db: 'VIA DB',
  elenco_buyer: 'Elenco Buyer',
  rsvp_spazio_camera_vinitaly_canada: 'RSVP Spazio Camera',
  rsvp_cena_aria_vinitaly_canada: 'RSVP Cena Aria',
  rsvp_ambasciata_vinitaly_canada: 'RSVP Ambasciata',
  rsvp_via_course_vinitaly_canada: 'RSVP VIA Course',
};

type SourceLike = Pick<ContactSource, 'source'> & Partial<Pick<ContactSource, 'source_key' | 'raw_data'>>;

export const VINITALY_CANADA_SOURCE_NAMES = [
  'rsvp_spazio_camera_vinitaly_canada',
  'rsvp_cena_aria_vinitaly_canada',
  'rsvp_ambasciata_vinitaly_canada',
  'rsvp_via_course_vinitaly_canada',
] as const satisfies readonly ContactSourceName[];

export const CATEGORY_FILTER_SOURCE_NAMES = [
  'elenco_buyer',
  ...VINITALY_CANADA_SOURCE_NAMES,
] as const satisfies readonly ContactSourceName[];

export const CATEGORY_FILTER_SOURCE_OPTIONS: Array<{ value: ContactSourceName; label: string }> = [
  { value: 'elenco_buyer', label: SOURCE_LABELS.elenco_buyer },
  { value: 'rsvp_spazio_camera_vinitaly_canada', label: SOURCE_LABELS.rsvp_spazio_camera_vinitaly_canada },
  { value: 'rsvp_cena_aria_vinitaly_canada', label: SOURCE_LABELS.rsvp_cena_aria_vinitaly_canada },
  { value: 'rsvp_ambasciata_vinitaly_canada', label: SOURCE_LABELS.rsvp_ambasciata_vinitaly_canada },
  { value: 'rsvp_via_course_vinitaly_canada', label: SOURCE_LABELS.rsvp_via_course_vinitaly_canada },
];

export function isViaDbSource(source: SourceLike | null | undefined): boolean {
  return Boolean(
    source?.source === 'via_db' ||
    source?.source_key?.startsWith('via_db:') ||
    source?.raw_data?.source === 'via_db',
  );
}

export function isCategoryFilterSourceName(source: string | null | undefined): source is ContactSourceName {
  return CATEGORY_FILTER_SOURCE_NAMES.some((item) => item === source);
}

export function isBuyerSource(source: SourceLike | null | undefined): boolean {
  return Boolean(
    source?.source === 'elenco_buyer' ||
    source?.source_key?.startsWith('elenco_buyer:') ||
    source?.raw_data?.source === 'elenco_buyer',
  );
}

export function isVinitalyCanadaSource(source: SourceLike | null | undefined): boolean {
  return Boolean(
    VINITALY_CANADA_SOURCE_NAMES.some((item) => source?.source === item) ||
    VINITALY_CANADA_SOURCE_NAMES.some((item) => source?.source_key?.startsWith(`${item}:`)) ||
    VINITALY_CANADA_SOURCE_NAMES.some((item) => source?.raw_data?.source === item),
  );
}

export function getSourceLabel(source: ContactSourceName, sourceRow?: SourceLike): string {
  if (isViaDbSource(sourceRow)) return SOURCE_LABELS.via_db;
  if (isBuyerSource(sourceRow)) return SOURCE_LABELS.elenco_buyer;
  const rawSource = sourceRow?.raw_data?.source;
  if (typeof rawSource === 'string' && rawSource in SOURCE_LABELS) {
    return SOURCE_LABELS[rawSource as ContactSourceName];
  }
  const keyedSource = CATEGORY_FILTER_SOURCE_NAMES.find((item) => sourceRow?.source_key?.startsWith(`${item}:`));
  if (keyedSource) return SOURCE_LABELS[keyedSource];
  return SOURCE_LABELS[source] ?? source.replace('_', ' ');
}

export function hasLinkedinSkSource(contact: Contact | null, sources?: Pick<ContactSource, 'source'>[]): boolean {
  const embeddedSources = contact?.contact_sources ?? [];
  return [...embeddedSources, ...(sources ?? [])].some((source) => source.source === 'linkedin_sk');
}

export function hasViaDbSource(contact: Contact | null, sources?: SourceLike[]): boolean {
  const embeddedSources = contact?.contact_sources ?? [];
  return [...embeddedSources, ...(sources ?? [])].some(isViaDbSource);
}

export function hasBuyerSource(contact: Contact | null, sources?: SourceLike[]): boolean {
  const embeddedSources = contact?.contact_sources ?? [];
  return [...embeddedSources, ...(sources ?? [])].some(isBuyerSource);
}

export function hasVinitalyCanadaSource(contact: Contact | null, sources?: SourceLike[]): boolean {
  const embeddedSources = contact?.contact_sources ?? [];
  return [...embeddedSources, ...(sources ?? [])].some(isVinitalyCanadaSource);
}
