import type { Contact, ContactSource, ContactSourceName } from '@/types/contact';

const SOURCE_LABELS: Record<ContactSourceName, string> = {
  wine_awards: 'Wine Awards',
  guildsomm: 'GuildSomm',
  linkedin_sk: 'Da LinkedIn SK',
  via_db: 'VIA DB',
};

type SourceLike = Pick<ContactSource, 'source'> & Partial<Pick<ContactSource, 'source_key' | 'raw_data'>>;

export function isViaDbSource(source: SourceLike | null | undefined): boolean {
  return Boolean(
    source?.source === 'via_db' ||
    source?.source_key?.startsWith('via_db:') ||
    source?.raw_data?.source === 'via_db',
  );
}

export function getSourceLabel(source: ContactSourceName, sourceRow?: SourceLike): string {
  if (isViaDbSource(sourceRow)) return SOURCE_LABELS.via_db;
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
