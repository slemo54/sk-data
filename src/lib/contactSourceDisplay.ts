import type { Contact, ContactSource, ContactSourceName } from '@/types/contact';

const SOURCE_LABELS: Record<ContactSourceName, string> = {
  wine_awards: 'Wine Awards',
  guildsomm: 'GuildSomm',
  linkedin_sk: 'Da LinkedIn SK',
};

export function getSourceLabel(source: ContactSourceName): string {
  return SOURCE_LABELS[source] ?? source.replace('_', ' ');
}

export function hasLinkedinSkSource(contact: Contact | null, sources?: Pick<ContactSource, 'source'>[]): boolean {
  const embeddedSources = contact?.contact_sources ?? [];
  return [...embeddedSources, ...(sources ?? [])].some((source) => source.source === 'linkedin_sk');
}
