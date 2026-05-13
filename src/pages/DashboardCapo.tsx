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
  fetchPendingOperators,
  approveOperator,
  rejectOperator,
} from '@/lib/contactsService';
import { hasLinkedinSkSource } from '@/lib/contactSourceDisplay';
import type { PendingOperator } from '@/lib/contactsService';
import { useDebounce } from '@/hooks/use-debounce';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
} from 'lucide-react';

const PAGE_SIZE = 10;

const DEFAULT_KPI: DashboardKpi = {
  total: 0,
  pendingReview: 0,
  readyToContact: 0,
  contacted: 0,
  approved: 0,
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-[#703E69]/5 text-[#703E69]/50 border-[#703E69]/10';
    case 'in_progress':
      return 'bg-[#703E69]/10 text-[#703E69]/75 border-[#703E69]/20';
    case 'reviewed':
      return 'bg-[#703E69]/20 text-[#703E69] border-[#703E69]/30';
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
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [filters, setFilters] = useState<ContactsFilters>({
    source: 'all',
    status: 'all',
    reviewStatus: 'all',
    nextAction: 'pronto_da_contattare',
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
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebounce(searchInput, 300);
  const [pendingOperators, setPendingOperators] = useState<PendingOperator[]>([]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.source !== 'all' ||
      filters.status !== 'all' ||
      filters.reviewStatus !== 'all' ||
      filters.nextAction !== 'all' ||
      filters.location !== undefined ||
      filters.country !== undefined ||
      filters.query !== undefined ||
      Boolean(filters.hasInstagram) ||
      Boolean(filters.hasLinkedin) ||
      Boolean(filters.hasEmail) ||
      filters.approved !== undefined ||
      filters.contacted !== undefined
    );
  }, [filters]);

  const refreshKpi = useCallback(async () => {
    try {
      const next = await fetchDashboardKpi();
      setKpi(next);
      setLastRefreshed(new Date().toLocaleString('it-IT'));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refreshPendingOperators = useCallback(async () => {
    try {
      const ops = await fetchPendingOperators();
      setPendingOperators(ops);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refreshContacts = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchContacts(
          filters,
          { page, pageSize: PAGE_SIZE },
          sort,
          signal,
        );
        if (signal?.aborted) return;
        setContacts(response.rows);
        setTotal(response.total);
        if (!selectedContactId && response.rows.length) {
          setSelectedContactId(response.rows[0].id);
        }
        if (
          selectedContactId &&
          !response.rows.find((r) => r.id === selectedContactId)
        ) {
          setSelectedContactId(response.rows[0]?.id ?? '');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Errore caricamento contatti');
      } finally {
        setLoading(false);
        setInitialLoadDone(true);
      }
    },
    [filters, page, selectedContactId, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refreshContacts(controller.signal);
    return () => controller.abort();
  }, [refreshContacts]);

  useEffect(() => {
    void refreshKpi();
  }, [refreshKpi]);

  useEffect(() => {
    void refreshPendingOperators();
    const interval = setInterval(refreshPendingOperators, 30000);
    return () => clearInterval(interval);
  }, [refreshPendingOperators]);

  useEffect(() => {
    if (!selectedContactId) {
      setSelectedSources([]);
      return;
    }
    void fetchContactSources(selectedContactId)
      .then((sources) => setSelectedSources(sources))
      .catch((err) => setError((err as Error).message || 'Errore provenance'));
  }, [selectedContactId]);

  useEffect(() => {
    handleFilterChange({ query: debouncedQuery || undefined });
  }, [debouncedQuery]);

  const handleFilterChange = (patch: Partial<ContactsFilters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
    setSelectedIds(new Set());
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

  const handleResetFilters = () => {
    setFilters({
      source: 'all',
      status: 'all',
      reviewStatus: 'all',
      nextAction: 'pronto_da_contattare',
    });
    setSearchInput('');
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
        {/* Banner operatori in attesa */}
        {pendingOperators.length > 0 && (
          <div className="rounded-xl border bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-800">
                  Operatori in attesa ({pendingOperators.length})
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {pendingOperators.map((op) => (
                <div key={op.id} className="flex items-center justify-between gap-4 bg-white rounded-lg p-3 border border-amber-200">
                  <span className="text-sm font-medium">{op.email}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      onClick={async () => {
                        await approveOperator(op.id);
                        toast.success(`${op.email} approvato`);
                        void refreshPendingOperators();
                      }}
                    >
                      Approva
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        await rejectOperator(op.id);
                        toast.success(`${op.email} rifiutato`);
                        void refreshPendingOperators();
                      }}
                    >
                      Rifiuta
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* 1. Ready to Contact */}
          <button
            type="button"
            aria-pressed={filters.nextAction === 'pronto_da_contattare'}
            onClick={() =>
              handleFilterChange(
                filters.nextAction === 'pronto_da_contattare'
                  ? { nextAction: 'all' }
                  : { nextAction: 'pronto_da_contattare' },
              )
            }
            className={`rounded-xl border p-5 shadow-sm flex items-center gap-4 text-left transition-colors ${
              filters.nextAction === 'pronto_da_contattare'
                ? 'ring-2 ring-emerald-500 bg-emerald-50/50'
                : 'bg-card hover:bg-muted/50'
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MailOpen className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to Contact</span>
              <span className="text-2xl font-bold">{kpi.readyToContact.toLocaleString()}</span>
            </div>
          </button>

          {/* 2. Approvati */}
          <button
            type="button"
            aria-pressed={filters.approved === true}
            onClick={() =>
              handleFilterChange(
                filters.approved === true ? { approved: undefined } : { approved: true },
              )
            }
            className={`rounded-xl border p-5 shadow-sm flex items-center gap-4 text-left transition-colors ${
              filters.approved === true
                ? 'ring-2 ring-blue-500 bg-blue-50/50'
                : 'bg-card hover:bg-muted/50'
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approvati</span>
              <span className="text-2xl font-bold">{kpi.approved.toLocaleString()}</span>
            </div>
          </button>

          {/* 3. Contacted */}
          <button
            type="button"
            aria-pressed={filters.contacted === true}
            onClick={() =>
              handleFilterChange(
                filters.contacted === true ? { contacted: undefined } : { contacted: true },
              )
            }
            className={`rounded-xl border p-5 shadow-sm flex items-center gap-4 text-left transition-colors ${
              filters.contacted === true
                ? 'ring-2 ring-orange-500 bg-orange-50/50'
                : 'bg-card hover:bg-muted/50'
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacted</span>
              <span className="text-2xl font-bold">{kpi.contacted.toLocaleString()}</span>
            </div>
          </button>

          {/* 4. Tutti */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tutti</span>
              <span className="text-2xl font-bold">{kpi.total.toLocaleString()}</span>
            </div>
          </button>

          {/* 5. Pending Review */}
          <button
            type="button"
            aria-pressed={filters.reviewStatus === 'unseen'}
            onClick={() =>
              handleFilterChange(
                filters.reviewStatus === 'unseen'
                  ? { reviewStatus: 'all' }
                  : { reviewStatus: 'unseen' },
              )
            }
            className={`rounded-xl border p-5 shadow-sm flex items-center gap-4 text-left transition-colors ${
              filters.reviewStatus === 'unseen'
                ? 'ring-2 ring-amber-500 bg-amber-50/50'
                : 'bg-card hover:bg-muted/50'
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <EyeOff className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</span>
              <span className="text-2xl font-bold">{kpi.pendingReview.toLocaleString()}</span>
            </div>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 flex flex-wrap items-center gap-3 border-b">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Cerca nome, email, social, employer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
              value={filters.source ?? 'all'}
              onValueChange={(v) => handleFilterChange({ source: v as 'all' | 'wine_awards' | 'guildsomm' | 'linkedin_sk' })}
            >
              <SelectTrigger className="w-[160px] h-9 bg-background">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le fonti</SelectItem>
                <SelectItem value="wine_awards">Wine Awards</SelectItem>
                <SelectItem value="guildsomm">GuildSomm</SelectItem>
                <SelectItem value="linkedin_sk">LinkedIn SK</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="text"
              placeholder="Luogo (città o paese)..."
              value={filters.location ?? ''}
              onChange={(e) => handleFilterChange({ location: e.target.value || undefined })}
              className="w-[220px] h-9 bg-background text-sm"
            />
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
            <Select
              value={filters.approved === true ? 'yes' : filters.approved === false ? 'no' : 'all'}
              onValueChange={(v) => handleFilterChange({ approved: v === 'yes' ? true : v === 'no' ? false : undefined })}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background">
                <SelectValue placeholder="Approvati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="yes">Approvati</SelectItem>
                <SelectItem value="no">Non appr.</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.contacted === true ? 'yes' : filters.contacted === false ? 'no' : 'all'}
              onValueChange={(v) => handleFilterChange({ contacted: v === 'yes' ? true : v === 'no' ? false : undefined })}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background">
                <SelectValue placeholder="Contattati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="yes">Contattati</SelectItem>
                <SelectItem value="no">Non cont.</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className={hasActiveFilters ? 'text-primary font-medium bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground'}
            >
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={bulkSaving} className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                    Elimina {selectedIds.size}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma eliminazione di gruppo</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sei sicuro di voler eliminare {selectedIds.size} contatto{selectedIds.size > 1 ? 'i' : ''}? Questa azione non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* Social counters */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Instagram className="h-4 w-4 text-pink-600" /> {socialCounts.instagram}</span>
          <span className="flex items-center gap-1"><Linkedin className="h-4 w-4 text-blue-700" /> {socialCounts.linkedin}</span>
          <span className="flex items-center gap-1"><Mail className="h-4 w-4 text-emerald-600" /> {socialCounts.email}</span>
          <span className="font-medium text-foreground">Tot: {total.toLocaleString()}</span>
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
                  <TableHead onClick={() => handleSort('full_name')} className="cursor-pointer whitespace-nowrap w-[220px]">
                    Nome {sort.field === 'full_name' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead onClick={() => handleSort('employer')} className="cursor-pointer whitespace-nowrap w-[200px]">
                    Restaurant / Location {sort.field === 'employer' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead onClick={() => handleSort('status')} className="cursor-pointer whitespace-nowrap text-center">
                    Stato {sort.field === 'status' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">Social</TableHead>
                  <TableHead onClick={() => handleSort('review_status')} className="cursor-pointer whitespace-nowrap text-center">
                    Review {sort.field === 'review_status' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead onClick={() => handleSort('approval')} className="cursor-pointer whitespace-nowrap text-center">
                    Approval {sort.field === 'approval' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead onClick={() => handleSort('contacted')} className="cursor-pointer whitespace-nowrap text-center">
                    Contacted {sort.field === 'contacted' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                  <TableHead onClick={() => handleSort('assigned_to')} className="cursor-pointer whitespace-nowrap text-center">
                    Assegnato {sort.field === 'assigned_to' ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
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
                {!loading && !contacts.length && initialLoadDone && (
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
                          {hasLinkedinSkSource(contact) && (
                            <img
                              src="./sk-linkedin-source.png"
                              alt="Da LinkedIn SK"
                              title="Da LinkedIn SK"
                              className="h-5 w-5 rounded-full object-contain"
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.occupation || contact.title || <span className="italic">Nessuna occupazione</span>}
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
                      <Switch checked={contact.contacted} onCheckedChange={() => void toggleField(contact, 'contacted')} aria-label="Toggle contacted" />
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

      <footer className="py-2 text-center text-[10px] text-muted-foreground/40 border-t border-border/40">
        by Anselmo Acquah
      </footer>

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
