import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import {
  fetchContacts,
  fetchContactSources,
  fetchDashboardKpi,
  updateContact,
} from '@/lib/contactsService';
import type {
  Contact,
  ContactPatch,
  ContactSource,
  ContactSort,
  ContactsFilters,
  DashboardKpi,
  NextAction,
} from '@/types/contact';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Instagram,
  Linkedin,
  LogOut,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

type EditableField = keyof ContactPatch;

const PAGE_SIZE = 50;

const DEFAULT_KPI: DashboardKpi = {
  total: 0,
  pendingReview: 0,
  readyToContact: 0,
  contacted: 0,
};

const NEXT_ACTION_OPTIONS: { value: NextAction; label: string }[] = [
  { value: 'pronto_da_contattare', label: 'Pronto da contattare' },
  { value: 'da_approvare', label: 'Da approvare' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'contattato', label: 'Contattato' },
  { value: 'da_verificare', label: 'Da verificare' },
  { value: 'chiuso', label: 'Chiuso' },
];

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getSocialHandle(url: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/^\//, '');
    return path.split('/')[0] || null;
  } catch {
    return url;
  }
}

function nextActionBadgeClass(action: NextAction | null): string {
  switch (action) {
    case 'pronto_da_contattare':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
    case 'da_approvare':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100';
    case 'follow_up':
      return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100';
    case 'contattato':
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100';
    case 'da_verificare':
      return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100';
    case 'chiuso':
      return 'bg-gray-800 text-white border-gray-700 hover:bg-gray-800';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
}

function formatNextAction(action: NextAction | null): string {
  if (!action) return '-';
  return NEXT_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

export default function DashboardCapo() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [kpi, setKpi] = useState<DashboardKpi>(DEFAULT_KPI);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ContactsFilters>({
    source: 'all',
    status: 'all',
    reviewStatus: 'all',
    nextAction: 'all',
  });
  const [sort, setSort] = useState<ContactSort>({ field: 'full_name', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedSources, setSelectedSources] = useState<ContactSource[]>([]);
  const [detailDraft, setDetailDraft] = useState<ContactPatch>({});
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const refreshKpi = useCallback(async () => {
    try {
      const next = await fetchDashboardKpi();
      setKpi(next);
      setLastRefreshed(new Date().toLocaleString('it-IT'));
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
      if (selectedContactId && !response.rows.find((r) => r.id === selectedContactId)) {
        setSelectedContactId(response.rows[0]?.id ?? '');
      }
    } catch (err) {
      setError((err as Error).message || 'Errore caricamento contatti');
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
      .catch((err) => setError((err as Error).message || 'Errore provenance'));
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
      next_action: selectedContact.next_action,
      notes: selectedContact.notes,
    });
  }, [selectedContact]);

  const countries = useMemo(
    () => [...new Set(contacts.map((c) => c.country).filter(Boolean))].sort(),
    [contacts],
  );

  const handleFilterChange = (patch: Partial<ContactsFilters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleSort = (field: ContactSort['field']) => {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' },
    );
  };

  const handleSaveDetail = async () => {
    if (!selectedContact) return;
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
        next_action: detailDraft.next_action ?? null,
        notes: normalizeNullable(detailDraft.notes ?? ''),
      };
      await updateContact(selectedContact.id, patch);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const setDraftValue = (field: EditableField, value: string) => {
    setDetailDraft((prev) => ({ ...prev, [field]: value }));
  };

  const toggleField = async (contact: Contact, field: 'review_status' | 'approval' | 'contacted') => {
    try {
      const patch: ContactPatch =
        field === 'review_status'
          ? { review_status: contact.review_status === 'seen' ? 'unseen' : 'seen' }
          : field === 'approval'
            ? { approval: !contact.approval }
            : { contacted: !contact.contacted };
      await updateContact(contact.id, patch);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Aggiornamento fallito');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-1 pt-4">
        <Button variant="ghost" size="icon" onClick={() => setPage(1)} disabled={page <= 1}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Pagina {page} di {totalPages}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="app-header">
        <div className="header-left">
          <h1 className="text-2xl font-bold tracking-tight">
            SK <span className="text-muted-foreground font-semibold">DATABASE</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {user ? 'Dashboard Capo — Vista operativa' : 'Dashboard Capo — Vista lettura'}
          </p>
        </div>
        <div className="header-right">
          {user && <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>}
          <Button variant="outline" size="sm" onClick={() => void refreshContacts()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground hidden md:inline">{lastRefreshed}</span>
          )}
          {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          )}
        </div>
      </header>

      <main className="main-content">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Profiles</span>
            <span className="text-2xl font-bold">{kpi.total.toLocaleString()}</span>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</span>
            <span className="text-2xl font-bold">{kpi.pendingReview.toLocaleString()}</span>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ready to Contact</span>
            <span className="text-2xl font-bold">{kpi.readyToContact.toLocaleString()}</span>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contacted</span>
            <span className="text-2xl font-bold">{kpi.contacted.toLocaleString()}</span>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-2 bg-card border rounded-xl p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Cerca nome, email, social, employer..."
              value={filters.query ?? ''}
              onChange={(e) => handleFilterChange({ query: e.target.value })}
              className="h-9"
            />
          </div>
          <Select
            value={filters.nextAction ?? 'all'}
            onValueChange={(v) => handleFilterChange({ nextAction: v === 'all' ? 'all' : (v as NextAction) })}
          >
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="Next Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le azioni</SelectItem>
              {NEXT_ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.reviewStatus ?? 'all'}
            onValueChange={(v) => handleFilterChange({ reviewStatus: v as 'all' | 'seen' | 'unseen' })}
          >
            <SelectTrigger className="w-[150px] h-9 bg-background">
              <SelectValue placeholder="Review Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="seen">Seen</SelectItem>
              <SelectItem value="unseen">Unseen</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.country ?? 'all'}
            onValueChange={(v) => handleFilterChange({ country: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-[150px] h-9 bg-background">
              <SelectValue placeholder="Paese" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i paesi</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c ?? ''}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="flex flex-wrap items-center gap-3 bg-muted/40 border rounded-lg p-3">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasInstagram)} onCheckedChange={(v) => handleFilterChange({ hasInstagram: Boolean(v) })} />
              IG
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasLinkedin)} onCheckedChange={(v) => handleFilterChange({ hasLinkedin: Boolean(v) })} />
              LinkedIn
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasEmail)} onCheckedChange={(v) => handleFilterChange({ hasEmail: Boolean(v) })} />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.approved)} onCheckedChange={(v) => handleFilterChange({ approved: v ? true : undefined })} />
              Approvati
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.contacted)} onCheckedChange={(v) => handleFilterChange({ contacted: v ? true : undefined })} />
              Contattati
            </label>
          </div>
        </section>

        {error && <div className="panel error-box">{error}</div>}

        <section className="table-panel">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead onClick={() => handleSort('full_name')} className="cursor-pointer whitespace-nowrap">Social Accounts</TableHead>
                    <TableHead className="whitespace-nowrap">Restaurant / Location</TableHead>
                    <TableHead className="whitespace-nowrap">Review Status</TableHead>
                    <TableHead className="whitespace-nowrap">Approval</TableHead>
                    <TableHead className="whitespace-nowrap">Contacted</TableHead>
                    <TableHead className="whitespace-nowrap">Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  )}
                  {!loading && !contacts.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun contatto trovato.</TableCell>
                    </TableRow>
                  )}
                  {!loading && contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className={`cursor-pointer ${contact.id === selectedContactId ? 'bg-muted/50' : ''}`}
                      onClick={() => { setSelectedContactId(contact.id); setSheetOpen(true); }}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm">{contact.full_name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {contact.instagram_url && (
                              <span className="flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-600" />@{getSocialHandle(contact.instagram_url)}</span>
                            )}
                            {contact.linkedin_url && (
                              <span className="flex items-center gap-1"><Linkedin className="h-3 w-3 text-blue-700" />{getSocialHandle(contact.linkedin_url)}</span>
                            )}
                            {!contact.instagram_url && !contact.linkedin_url && <span className="text-muted-foreground/60">Nessun social</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{contact.employer ?? '-'}</span>
                          <span className="text-xs text-muted-foreground">{[contact.city, contact.country].filter(Boolean).join(', ') || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {user ? (
                          <button onClick={() => void toggleField(contact, 'review_status')} className="focus:outline-none">
                            <Badge variant="outline" className={contact.review_status === 'seen'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                              : 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 cursor-pointer'}>
                              {contact.review_status === 'seen' ? 'Seen' : 'Unseen'}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant="outline" className={contact.review_status === 'seen'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200'}>
                            {contact.review_status === 'seen' ? 'Seen' : 'Unseen'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Switch checked={contact.approval} onCheckedChange={() => void toggleField(contact, 'approval')} aria-label="Toggle approval" disabled={!user} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => void toggleField(contact, 'contacted')} className="focus:outline-none" disabled={!user}>
                          {contact.contacted ? <Check className={`h-5 w-5 ${user ? 'text-emerald-600' : 'text-emerald-600/60'}`} /> : <X className={`h-5 w-5 ${user ? 'text-red-500' : 'text-red-500/60'}`} />}
                        </button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={nextActionBadgeClass(contact.next_action)}>
                          {formatNextAction(contact.next_action)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {renderPagination()}
          </div>
        </section>
      </main>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Dettaglio Persona</SheetTitle></SheetHeader>
          {selectedContact && (
            <div className="mt-6 flex flex-col gap-6">
              <div className="detail-grid">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Email</span>
                  {user ? (
                    <Input value={detailDraft.email ?? ''} onChange={(e) => setDraftValue('email', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.email || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Instagram</span>
                  {user ? (
                    <Input value={detailDraft.instagram_url ?? ''} onChange={(e) => setDraftValue('instagram_url', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.instagram_url || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">LinkedIn</span>
                  {user ? (
                    <Input value={detailDraft.linkedin_url ?? ''} onChange={(e) => setDraftValue('linkedin_url', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.linkedin_url || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Employer</span>
                  {user ? (
                    <Input value={detailDraft.employer ?? ''} onChange={(e) => setDraftValue('employer', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.employer || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Title</span>
                  {user ? (
                    <Input value={detailDraft.title ?? ''} onChange={(e) => setDraftValue('title', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.title || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Occupation</span>
                  {user ? (
                    <Input value={detailDraft.occupation ?? ''} onChange={(e) => setDraftValue('occupation', e.target.value)} />
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{detailDraft.occupation || '-'}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted-foreground/70">Next Action</span>
                  {user ? (
                    <Select value={detailDraft.next_action ?? 'none'} onValueChange={(v) => setDetailDraft((prev) => ({ ...prev, next_action: v === 'none' ? null : (v as NextAction) }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona azione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {NEXT_ACTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="py-2 px-3 border rounded-md bg-muted/20 min-h-[40px] flex items-center">{formatNextAction(detailDraft.next_action || null)}</div>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-muted-foreground/70">Note</span>
                  {user ? (
                    <textarea className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={detailDraft.notes ?? ''} onChange={(e) => setDraftValue('notes', e.target.value)} />
                  ) : (
                    <div className="py-3 px-3 border rounded-md bg-muted/20 min-h-[80px] text-sm whitespace-pre-wrap">{detailDraft.notes || '-'}</div>
                  )}
                </label>
              </div>
              {user && (
                <div className="flex items-center gap-3">
                  <Button onClick={() => void handleSaveDetail()} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold mb-2">Provenienze</h3>
                {!selectedSources.length && <p className="text-sm text-muted-foreground">Nessuna provenance disponibile.</p>}
                {!!selectedSources.length && (
                  <ul className="flex flex-col gap-2">
                    {selectedSources.map((source) => (
                      <li key={source.id} className="text-sm border rounded-lg p-3 bg-muted/30">
                        <div className="font-medium capitalize">{source.source.replace('_', ' ')}</div>
                        <div className="text-muted-foreground">{source.restaurant_name ?? '-'} · {source.award ?? '-'} · {source.wine_role ?? '-'}</div>
                        {source.profile_url && <a href={source.profile_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Profilo</a>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
