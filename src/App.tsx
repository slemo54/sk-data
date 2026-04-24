import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  claimContacts,
  fetchContacts,
  fetchContactSources,
  fetchDashboardKpi,
  setContactStatus,
  updateContact,
} from '@/lib/contactsService';
import type {
  Contact,
  ContactPatch,
  ContactSource,
  ContactSort,
  ContactsFilters,
  DashboardKpi,
  ReviewStatus,
} from '@/types/contact';

type EditableField = keyof ContactPatch;

const PAGE_SIZE = 50;

const DEFAULT_KPI: DashboardKpi = {
  total: 0,
  withSocial: 0,
  withEmail: 0,
  inReview: 0,
  reviewed: 0,
  unassigned: 0,
};

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getNextStatus(current: ReviewStatus): ReviewStatus {
  if (current === 'todo') {
    return 'in_progress';
  }
  if (current === 'in_progress') {
    return 'reviewed';
  }
  return 'reviewed';
}

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [kpi, setKpi] = useState<DashboardKpi>(DEFAULT_KPI);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [userId, setUserId] = useState<string>(() => localStorage.getItem('skdb_user_id') ?? '');
  const [filters, setFilters] = useState<ContactsFilters>({
    source: 'all',
    status: 'all',
  });

  const [sort, setSort] = useState<ContactSort>({
    field: 'full_name',
    direction: 'asc',
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [claimCount, setClaimCount] = useState(25);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<ContactSource[]>([]);
  const [detailDraft, setDetailDraft] = useState<ContactPatch>({});
  const [saving, setSaving] = useState(false);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const refreshKpi = useCallback(async () => {
    try {
      const next = await fetchDashboardKpi();
      setKpi(next);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchContacts(filters, { page, pageSize: PAGE_SIZE }, sort);
      setContacts(response.rows);
      setTotal(response.total);
      if (!selectedContactId && response.rows.length) {
        setSelectedContactId(response.rows[0].id);
      }
      if (selectedContactId && !response.rows.find((row) => row.id === selectedContactId)) {
        setSelectedContactId(response.rows[0]?.id ?? '');
      }
    } catch (err) {
      setError((err as Error).message || 'Unable to load contacts');
    } finally {
      setLoading(false);
    }
  }, [filters, page, selectedContactId, sort]);

  useEffect(() => {
    void refreshContacts();
  }, [refreshContacts]);

  useEffect(() => {
    void refreshKpi();
  }, [refreshKpi]);

  useEffect(() => {
    if (!selectedContactId) {
      setSelectedSources([]);
      setDetailDraft({});
      return;
    }

    void fetchContactSources(selectedContactId)
      .then((sources) => setSelectedSources(sources))
      .catch((err) => setError((err as Error).message || 'Unable to load source details'));
  }, [selectedContactId]);

  useEffect(() => {
    if (!selectedContact) {
      setDetailDraft({});
      return;
    }

    setDetailDraft({
      email: selectedContact.email,
      instagram_url: selectedContact.instagram_url,
      linkedin_url: selectedContact.linkedin_url,
      employer: selectedContact.employer,
      title: selectedContact.title,
      occupation: selectedContact.occupation,
    });
  }, [selectedContact]);

  const countries = useMemo(
    () => [...new Set(contacts.map((contact) => contact.country).filter(Boolean))].sort(),
    [contacts],
  );

  const handleFilterChange = (patch: Partial<ContactsFilters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleSort = (field: ContactSort['field']) => {
    setSort((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        field,
        direction: 'asc',
      };
    });
  };

  const handleClaim = async () => {
    if (!userId.trim()) {
      setError('Set your user ID before claiming contacts.');
      return;
    }

    try {
      await claimContacts(claimCount, userId.trim());
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Claim failed');
    }
  };

  const handleStatusAdvance = async (contactId: string, currentStatus: ReviewStatus) => {
    try {
      await setContactStatus(contactId, getNextStatus(currentStatus));
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Status update failed');
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedContact) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const patch: ContactPatch = {
        email: normalizeNullable(detailDraft.email ?? ''),
        instagram_url: normalizeNullable(detailDraft.instagram_url ?? ''),
        linkedin_url: normalizeNullable(detailDraft.linkedin_url ?? ''),
        employer: normalizeNullable(detailDraft.employer ?? ''),
        title: normalizeNullable(detailDraft.title ?? ''),
        occupation: normalizeNullable(detailDraft.occupation ?? ''),
      };

      await updateContact(selectedContact.id, patch);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setDraftValue = (field: EditableField, value: string) => {
    setDetailDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>
            SK <span>DATABASE</span>
          </h1>
          <p className="subtitle">Dashboard Persone Unificata: Wine Awards + GuildSomm</p>
        </div>
        <div className="user-box">
          <label htmlFor="userId">Operator ID</label>
          <input
            id="userId"
            value={userId}
            onChange={(event) => {
              const value = event.target.value;
              setUserId(value);
              localStorage.setItem('skdb_user_id', value);
            }}
            placeholder="nome.cognome"
          />
        </div>
      </header>

      <main className="main-grid">
        <section className="panel kpi-grid">
          <article className="kpi-card">
            <h3>Totale Contatti</h3>
            <p>{kpi.total.toLocaleString()}</p>
          </article>
          <article className="kpi-card">
            <h3>Con Social</h3>
            <p>{kpi.withSocial.toLocaleString()}</p>
          </article>
          <article className="kpi-card">
            <h3>Con Email</h3>
            <p>{kpi.withEmail.toLocaleString()}</p>
          </article>
          <article className="kpi-card">
            <h3>In Review</h3>
            <p>{kpi.inReview.toLocaleString()}</p>
          </article>
          <article className="kpi-card">
            <h3>Reviewed</h3>
            <p>{kpi.reviewed.toLocaleString()}</p>
          </article>
          <article className="kpi-card">
            <h3>Unassigned</h3>
            <p>{kpi.unassigned.toLocaleString()}</p>
          </article>
        </section>

        <section className="panel filters-panel">
          <div className="filter-row">
            <label htmlFor="query">Ricerca</label>
            <input
              id="query"
              value={filters.query ?? ''}
              placeholder="Nome, email, social, employer"
              onChange={(event) => handleFilterChange({ query: event.target.value })}
            />
          </div>
          <div className="filter-row">
            <label htmlFor="country">Paese</label>
            <select
              id="country"
              value={filters.country ?? 'all'}
              onChange={(event) =>
                handleFilterChange({
                  country: event.target.value === 'all' ? undefined : event.target.value,
                })
              }
            >
              <option value="all">Tutti</option>
              {countries.map((countryValue) => (
                <option key={countryValue} value={countryValue ?? ''}>
                  {countryValue}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-row">
            <label htmlFor="source">Source</label>
            <select
              id="source"
              value={filters.source ?? 'all'}
              onChange={(event) =>
                handleFilterChange({
                  source: event.target.value === 'all' ? 'all' : (event.target.value as ContactsFilters['source']),
                })
              }
            >
              <option value="all">Tutte</option>
              <option value="wine_awards">Wine Awards</option>
              <option value="guildsomm">GuildSomm</option>
            </select>
          </div>
          <div className="filter-row">
            <label htmlFor="status">Workflow</label>
            <select
              id="status"
              value={filters.status ?? 'all'}
              onChange={(event) =>
                handleFilterChange({
                  status: event.target.value === 'all' ? 'all' : (event.target.value as ReviewStatus),
                })
              }
            >
              <option value="all">Tutti</option>
              <option value="todo">todo</option>
              <option value="in_progress">in_progress</option>
              <option value="reviewed">reviewed</option>
            </select>
          </div>
          <div className="filter-checks">
            <label>
              <input
                type="checkbox"
                checked={Boolean(filters.hasInstagram)}
                onChange={(event) => handleFilterChange({ hasInstagram: event.target.checked })}
              />
              IG
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(filters.hasLinkedin)}
                onChange={(event) => handleFilterChange({ hasLinkedin: event.target.checked })}
              />
              LinkedIn
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(filters.hasEmail)}
                onChange={(event) => handleFilterChange({ hasEmail: event.target.checked })}
              />
              Email
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(filters.assignedToMe)}
                onChange={(event) =>
                  handleFilterChange({
                    assignedToMe: event.target.checked,
                    userId,
                  })
                }
              />
              Assegnati a me
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(filters.unassigned)}
                onChange={(event) => handleFilterChange({ unassigned: event.target.checked })}
              />
              Non assegnati
            </label>
          </div>
          <div className="claim-row">
            <label htmlFor="claimCount">Claim N</label>
            <input
              id="claimCount"
              type="number"
              min={1}
              max={250}
              value={claimCount}
              onChange={(event) => setClaimCount(Number(event.target.value || '1'))}
            />
            <button type="button" onClick={handleClaim}>
              Claim
            </button>
            <button type="button" className="secondary" onClick={() => void refreshContacts()}>
              Refresh
            </button>
          </div>
        </section>

        {error && <div className="panel error-box">{error}</div>}

        <section className="panel table-panel">
          <div className="table-meta">
            <p>
              {total.toLocaleString()} contatti, pagina {page} / {totalPages}
            </p>
            <div className="pager">
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('full_name')}>Nome</th>
                  <th>IG</th>
                  <th>LinkedIn</th>
                  <th>Email</th>
                  <th onClick={() => handleSort('employer')}>Employer</th>
                  <th>Title / Occupation</th>
                  <th onClick={() => handleSort('country')}>City / Country</th>
                  <th onClick={() => handleSort('status')}>Status</th>
                  <th onClick={() => handleSort('assigned_to')}>Assigned</th>
                  <th>Azione</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10}>Loading...</td>
                  </tr>
                )}
                {!loading && !contacts.length && (
                  <tr>
                    <td colSpan={10}>No contacts found.</td>
                  </tr>
                )}
                {!loading &&
                  contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={contact.id === selectedContactId ? 'selected' : ''}
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      <td>{contact.full_name}</td>
                      <td>
                        {contact.instagram_url ? (
                          <a href={contact.instagram_url} target="_blank" rel="noreferrer">
                            IG
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {contact.linkedin_url ? (
                          <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
                            in
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{contact.email ?? '-'}</td>
                      <td>{contact.employer ?? '-'}</td>
                      <td>{[contact.title, contact.occupation].filter(Boolean).join(' / ') || '-'}</td>
                      <td>
                        {[contact.city, contact.country].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td>
                        <span className={`status-pill status-${contact.status}`}>{contact.status}</span>
                      </td>
                      <td>{contact.assigned_to ?? '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="tiny"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleStatusAdvance(contact.id, contact.status);
                          }}
                        >
                          Next
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel detail-panel">
          <h2>Dettaglio Persona</h2>
          {!selectedContact && <p>Seleziona un contatto dalla tabella.</p>}
          {selectedContact && (
            <>
              <div className="detail-grid">
                <label>
                  Email
                  <input
                    value={detailDraft.email ?? ''}
                    onChange={(event) => setDraftValue('email', event.target.value)}
                  />
                </label>
                <label>
                  Instagram
                  <input
                    value={detailDraft.instagram_url ?? ''}
                    onChange={(event) => setDraftValue('instagram_url', event.target.value)}
                  />
                </label>
                <label>
                  LinkedIn
                  <input
                    value={detailDraft.linkedin_url ?? ''}
                    onChange={(event) => setDraftValue('linkedin_url', event.target.value)}
                  />
                </label>
                <label>
                  Employer
                  <input
                    value={detailDraft.employer ?? ''}
                    onChange={(event) => setDraftValue('employer', event.target.value)}
                  />
                </label>
                <label>
                  Title
                  <input
                    value={detailDraft.title ?? ''}
                    onChange={(event) => setDraftValue('title', event.target.value)}
                  />
                </label>
                <label>
                  Occupation
                  <input
                    value={detailDraft.occupation ?? ''}
                    onChange={(event) => setDraftValue('occupation', event.target.value)}
                  />
                </label>
              </div>
              <div className="detail-actions">
                <button type="button" onClick={() => void handleSaveDetail()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <h3>Provenienze</h3>
              {!selectedSources.length && <p>Nessuna provenance disponibile.</p>}
              {!!selectedSources.length && (
                <ul className="source-list">
                  {selectedSources.map((source) => (
                    <li key={source.id}>
                      <strong>{source.source}</strong> · {source.restaurant_name ?? '-'} · {source.award ?? '-'} ·{' '}
                      {source.wine_role ?? '-'}
                      {source.profile_url && (
                        <>
                          {' '}
                          ·{' '}
                          <a href={source.profile_url} target="_blank" rel="noreferrer">
                            profile
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
