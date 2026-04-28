import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  deleteContact,
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
  ReviewVisibility,
} from '@/types/contact';
import SKContactDrawer from '@/components/SKContactDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  EyeOff,
  FileText,
  Instagram,
  Linkedin,
  LogOut,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

const PAGE_SIZE = 50;

const DEFAULT_KPI: DashboardKpi = {
  total: 0,
  pendingReview: 0,
  readyToContact: 0,
  contacted: 0,
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'reviewed':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'todo':
      return 'Da fare';
    case 'in_progress':
      return 'In corso';
    case 'reviewed':
      return 'Revisionato';
    default:
      return status;
  }
}

export default function DashboardSK() {
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
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<ContactSource[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

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
      return;
    }
    void fetchContactSources(selectedContactId)
      .then((sources) => setSelectedSources(sources))
      .catch((err) => setError((err as Error).message || 'Errore provenance'));
  }, [selectedContactId]);

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

  const toggleField = async (contact: Contact, field: 'review_status' | 'approval' | 'contacted') => {
    try {
      const patch: ContactPatch =
        field === 'review_status'
          ? { review_status: (contact.review_status === 'seen' ? 'unseen' : 'seen') as ReviewVisibility }
          : field === 'approval'
            ? { approval: !contact.approval }
            : { contacted: !contact.contacted };
      await updateContact(contact.id, patch);
      toast.success(field === 'review_status' ? 'Review aggiornata' : field === 'approval' ? 'Approval aggiornata' : 'Contattato aggiornato');
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Aggiornamento fallito');
    }
  };

  const markSeen = async (contact: Contact) => {
    if (contact.review_status === 'unseen') {
      try {
        await updateContact(contact.id, { review_status: 'seen' as ReviewVisibility });
        await refreshContacts();
        await refreshKpi();
      } catch {
        // silent fail
      }
    }
  };

  const handleUpdateNextAction = async (nextAction: NextAction | null) => {
    if (!selectedContact) return;
    try {
      await updateContact(selectedContact.id, { next_action: nextAction });
      toast.success('Next Action aggiornata');
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

  function getSocialHandle(url: string | null): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.pathname.replace(/^\//, '').split('/')[0] || null;
    } catch {
      return null;
    }
  }

  const handleResetFilters = () => {
    setFilters({
      source: 'all',
      status: 'all',
      reviewStatus: 'all',
      nextAction: 'all',
    });
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleToggleSelectAll = () => {
    const visibleIds = contacts.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.size) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateContact(id, { approval: true }))
      );
      toast.success(`${selectedIds.size} contatti approvati`);
      setSelectedIds(new Set());
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      toast.error((err as Error).message || 'Bulk approval fallito');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContact(id);
      toast.success('Contatto eliminato');
      setSheetOpen(false);
      setSelectedContactId('');
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      toast.error((err as Error).message || 'Eliminazione fallita');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkSaving(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteContact(id)));
      toast.success(`${selectedIds.size} contatti eliminati`);
      setSelectedIds(new Set());
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      toast.error((err as Error).message || 'Bulk delete fallito');
    } finally {
      setBulkSaving(false);
    }
  };

  const socialCounts = useMemo(() => {
    return {
      instagram: contacts.filter((c) => c.instagram_url).length,
      linkedin: contacts.filter((c) => c.linkedin_url).length,
      email: contacts.filter((c) => c.email).length,
    };
  }, [contacts]);

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SK <span className="text-muted-foreground font-semibold">DATABASE</span>
            </h1>
            <p className="text-sm text-muted-foreground">Dashboard SK — Vista operativa</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => void refreshContacts()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden md:inline">{lastRefreshed}</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Profiles</span>
              <span className="text-2xl font-bold">{kpi.total.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <EyeOff className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</span>
              <span className="text-2xl font-bold">{kpi.pendingReview.toLocaleString()}</span>
            </div>
          </div>
          <div
            className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleFilterChange({ nextAction: 'pronto_da_contattare' })}
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MailOpen className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to Contact</span>
              <span className="text-2xl font-bold">{kpi.readyToContact.toLocaleString()}</span>
            </div>
          </div>
          <div
            className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleFilterChange({ contacted: true })}
          >
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacted</span>
              <span className="text-2xl font-bold">{kpi.contacted.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 flex flex-wrap items-center gap-3 border-b">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Cerca nome, email, social, employer..."
                value={filters.query ?? ''}
                onChange={(e) => handleFilterChange({ query: e.target.value })}
                className="h-9"
              />
            </div>
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
              value={filters.nextAction ?? 'all'}
              onValueChange={(v) => handleFilterChange({ nextAction: v === 'all' ? 'all' : (v as NextAction) })}
            >
              <SelectTrigger className="w-[170px] h-9 bg-background">
                <SelectValue placeholder="Next Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le azioni</SelectItem>
                <SelectItem value="pronto_da_contattare">Pronto da contattare</SelectItem>
                <SelectItem value="da_approvare">Da approvare</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="contattato">Contattato</SelectItem>
                <SelectItem value="da_verificare">Da verificare</SelectItem>
                <SelectItem value="chiuso">Chiuso</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.country ?? 'all'}
              onValueChange={(v) => handleFilterChange({ country: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-[160px] h-9 bg-background">
                <SelectValue placeholder="Paese" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i paesi</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c ?? ''}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 flex flex-wrap items-center gap-4 bg-muted/30">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasInstagram)} onCheckedChange={(v) => handleFilterChange({ hasInstagram: Boolean(v) })} />
              <span className="text-muted-foreground">IG</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasLinkedin)} onCheckedChange={(v) => handleFilterChange({ hasLinkedin: Boolean(v) })} />
              <span className="text-muted-foreground">LinkedIn</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.hasEmail)} onCheckedChange={(v) => handleFilterChange({ hasEmail: Boolean(v) })} />
              <span className="text-muted-foreground">Email</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.approved)} onCheckedChange={(v) => handleFilterChange({ approved: v ? true : undefined })} />
              <span className="text-muted-foreground">Approvati</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={Boolean(filters.contacted)} onCheckedChange={(v) => handleFilterChange({ contacted: v ? true : undefined })} />
              <span className="text-muted-foreground">Contattati</span>
            </label>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
              Reset filtri
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
            <span className="text-sm font-medium">
              {selectedIds.size} selezionato{selectedIds.size > 1 ? 'i' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBulkApprove} disabled={bulkSaving} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {bulkSaving ? 'Approvo...' : `Approva ${selectedIds.size}`}
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={bulkSaving} className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
                Elimina {selectedIds.size}
              </Button>
            </div>
          </div>
        )}

        {/* Social counters */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Instagram className="h-4 w-4 text-pink-600" /> {socialCounts.instagram}</span>
          <span className="flex items-center gap-1"><Linkedin className="h-4 w-4 text-blue-700" /> {socialCounts.linkedin}</span>
          <span className="flex items-center gap-1"><Mail className="h-4 w-4 text-emerald-600" /> {socialCounts.email}</span>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="w-[40px] text-center">
                    <Checkbox
                      checked={contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id))}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Seleziona tutti"
                    />
                  </TableHead>
                  <TableHead onClick={() => handleSort('full_name')} className="cursor-pointer whitespace-nowrap w-[220px]">Nome</TableHead>
                  <TableHead className="whitespace-nowrap w-[200px]">Restaurant / Location</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Stato Operatore</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Social</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Review</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Approval</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Contacted</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Assegnato</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Caricamento contatti...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !contacts.length && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      Nessun contatto trovato.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className={`cursor-pointer transition-colors ${contact.id === selectedContactId ? 'bg-muted/60' : 'hover:bg-muted/40'}`}
                    onClick={() => { void markSeen(contact); setSelectedContactId(contact.id); setSheetOpen(true); }}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => handleToggleSelect(contact.id)}
                        aria-label="Seleziona riga"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{contact.full_name}</span>
                          {contact.notes && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                              Note
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {contact.instagram_url && (
                            <span className="flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-600" />@{getSocialHandle(contact.instagram_url) || 'IG'}</span>
                          )}
                          {contact.linkedin_url && (
                            <span className="flex items-center gap-1"><Linkedin className="h-3 w-3 text-blue-700" />{getSocialHandle(contact.linkedin_url) || 'LI'}</span>
                          )}
                          {!contact.instagram_url && !contact.linkedin_url && <span className="italic">Nessun social</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 py-1">
                        <span className="text-sm font-medium">{contact.employer ?? '-'}</span>
                        <span className="text-xs text-muted-foreground">{[contact.city, contact.country].filter(Boolean).join(', ') || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusBadgeClass(contact.status)}>
                        {statusLabel(contact.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.instagram_url && contact.linkedin_url ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                          <Instagram className="h-3 w-3" />
                          <Linkedin className="h-3 w-3" />
                          Completo
                        </Badge>
                      ) : contact.instagram_url || contact.linkedin_url ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                          {contact.instagram_url ? <Instagram className="h-3 w-3" /> : <Linkedin className="h-3 w-3" />}
                          Parziale
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                          Mancante
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <button onClick={() => void toggleField(contact, 'review_status')} className="focus:outline-none">
                        <Badge
                          variant="outline"
                          className={contact.review_status === 'seen'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 cursor-pointer'}
                        >
                          {contact.review_status === 'seen' ? 'Seen' : 'Unseen'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <Switch checked={contact.approval} onCheckedChange={() => void toggleField(contact, 'approval')} aria-label="Toggle approval" />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <button onClick={() => void toggleField(contact, 'contacted')} className="focus:outline-none inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
                        {contact.contacted ? <Check className="h-5 w-5 text-emerald-600" /> : <X className="h-5 w-5 text-red-400" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground truncate max-w-[120px]">
                      {contact.assigned_to ?? '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {contact.notes && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs whitespace-pre-wrap">{contact.notes}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {contact.instagram_url && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { void markSeen(contact); window.open(contact.instagram_url!, '_blank', 'noopener,noreferrer'); }}>
                            <Instagram className="h-4 w-4 text-pink-600" />
                          </Button>
                        )}
                        {contact.linkedin_url && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { void markSeen(contact); window.open(contact.linkedin_url!, '_blank', 'noopener,noreferrer'); }}>
                            <Linkedin className="h-4 w-4 text-blue-700" />
                          </Button>
                        )}
                        {contact.email && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { void markSeen(contact); window.open(`mailto:${contact.email}`, '_blank'); }}>
                            <Mail className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {renderPagination()}
        </div>
      </main>

      <SKContactDrawer
        contact={selectedContact}
        sources={selectedSources}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdateNextAction={handleUpdateNextAction}
        onDelete={() => {
          if (selectedContact) void handleDelete(selectedContact.id);
        }}
      />
    </div>
  );
}
