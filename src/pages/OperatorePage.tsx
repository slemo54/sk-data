import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import OperatorContactDrawer from '@/components/OperatorContactDrawer';
import {
  // addNote,
  claimContacts,
  claimSingleContact,
  fetchContacts,
  fetchContactSources,
  fetchDashboardKpi,
  toggleApproval,
  toggleContacted,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Instagram,
  Linkedin,
  // Lock,
  LogOut,
  MessageSquare,
  // NotebookPen,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

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

export default function OperatorePage() {
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

  const [sort, setSort] = useState<ContactSort>({
    field: 'full_name',
    direction: 'asc',
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [claimCount, setClaimCount] = useState(25);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<ContactSource[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');

  const userEmail = user?.email ?? '';

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
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
      return;
    }
    void fetchContactSources(selectedContactId)
      .then((sources) => setSelectedSources(sources))
      .catch((err) => setError((err as Error).message || 'Unable to load source details'));
  }, [selectedContactId]);

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
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const handleClaim = async () => {
    if (!userEmail) {
      toast.error('Devi essere autenticato per fare claim.');
      return;
    }
    try {
      const claimed = await claimContacts(claimCount, userEmail);
      if (claimed.length === 0) {
        toast.info('Nessun contatto disponibile per il claim.');
        return;
      }
      toast.success(`${claimed.length} contatti assegnati a te`);
      handleFilterChange({ assignedToMe: true, userId: userEmail });
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      toast.error((err as Error).message || 'Claim fallito');
    }
  };

  const handleReadyToContact = async () => {
    if (!selectedContact) return;
    try {
      await updateContact(selectedContact.id, {
        next_action: 'pronto_da_contattare',
        status: 'reviewed',
      });
      toast.success('Segnalato come Pronto a contattare');
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Aggiornamento fallito');
    }
  };

  const handleClaimSingle = async () => {
    if (!selectedContact) return;
    try {
      await claimSingleContact(selectedContact.id, userEmail);
      toast.success('Contatto assegnato a te');
      setSheetOpen(false);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      toast.error((err as Error).message || 'Claim fallito');
    }
  };

  const handleSave = async (patch: ContactPatch) => {
    if (!selectedContact) return;
    try {
      await updateContact(selectedContact.id, patch);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Save failed');
    }
  };

  const handleToggleApproval = async (contact: Contact) => {
    try {
      await toggleApproval(contact.id, !contact.approval);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Approval toggle failed');
    }
  };

  const handleToggleContacted = async (contact: Contact) => {
    try {
      await toggleContacted(contact.id, !contact.contacted);
      await refreshContacts();
      await refreshKpi();
    } catch (err) {
      setError((err as Error).message || 'Contacted toggle failed');
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
      nextAction: 'all',
    });
    setPage(1);
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SK <span className="text-muted-foreground font-semibold">DATABASE</span>
            </h1>
            <p className="text-sm text-muted-foreground">Backend Operatori</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
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
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Profiles</span>
              <span className="text-2xl font-bold">{kpi.total.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Search className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</span>
              <span className="text-2xl font-bold">{kpi.pendingReview.toLocaleString()}</span>
            </div>
          </div>
          <div
            className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-accent/40 transition-colors"
            onClick={() => {
              setFilters((prev) => ({ ...prev, nextAction: 'pronto_da_contattare' }));
              setPage(1);
            }}
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to Contact</span>
              <span className="text-2xl font-bold">{kpi.readyToContact.toLocaleString()}</span>
            </div>
          </div>
          <div
            className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-accent/40 transition-colors"
            onClick={() => {
              setFilters((prev) => ({ ...prev, contacted: true }));
              setPage(1);
            }}
          >
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Check className="h-5 w-5" />
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
              value={filters.nextAction ?? 'all'}
              onValueChange={(v) => handleFilterChange({ nextAction: v === 'all' ? 'all' : (v as NextAction) })}
            >
              <SelectTrigger className="w-[170px] h-9 bg-background">
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

          <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
            <div className="flex flex-wrap gap-5 items-center">
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={Boolean(filters.assignedToMe)} onCheckedChange={(v) => handleFilterChange({ assignedToMe: Boolean(v), userId: userEmail })} />
                <span className="text-muted-foreground">Assegnati a me</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={Boolean(filters.unassigned)} onCheckedChange={(v) => handleFilterChange({ unassigned: Boolean(v) })} />
                <span className="text-muted-foreground">Non assegnati</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={Boolean(filters.assignedToOthers)} onCheckedChange={(v) => handleFilterChange({ assignedToOthers: Boolean(v), userId: userEmail })} />
                <span className="text-muted-foreground">Assegnati ad altri</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
                Reset filtri
              </Button>
              <span className="text-sm text-muted-foreground">Claim</span>
              <Input
                type="number"
                min={1}
                max={250}
                value={claimCount}
                onChange={(e) => setClaimCount(Number(e.target.value || '1'))}
                className="w-16 h-8 text-center"
              />
              <Button size="sm" onClick={handleClaim}>Vai</Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="whitespace-nowrap w-[40px]"></TableHead>
                  <TableHead onClick={() => handleSort('full_name')} className="cursor-pointer whitespace-nowrap w-[200px]">Social Accounts</TableHead>
                  <TableHead className="whitespace-nowrap w-[180px]">Restaurant / Location</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Review</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Approval</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Contacted</TableHead>
                  <TableHead className="whitespace-nowrap">Assegnato</TableHead>
                  <TableHead className="whitespace-nowrap">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Caricamento contatti...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !contacts.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nessun contatto trovato.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && contacts.map((contact) => {
                  const isMine = contact.assigned_to === userEmail;
                  const isLocked = !isMine;
                  const rowBg = isMine
                    ? 'bg-emerald-50/40'
                    : contact.assigned_to
                      ? 'bg-rose-50/40'
                      : '';
                  return (
                    <TableRow
                      key={contact.id}
                      className={`transition-colors ${rowBg} ${contact.id === selectedContactId ? 'bg-muted/60' : 'hover:bg-muted/40'} ${isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={() => { setSelectedContactId(contact.id); setSheetOpen(true); }}
                    >
                      <TableCell className="py-2 text-center">
                        {isMine ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]" title="Assegnato a te">
                            Tu
                          </Badge>
                        ) : contact.assigned_to ? (
                          <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]" title={`Assegnato a ${contact.assigned_to}`}>
                            Occupato
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]" title="Non assegnato">
                            Libero
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 py-1">
                          <span className="font-semibold text-sm">{contact.full_name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {contact.instagram_url && (
                              <span className="flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-600" />@{new URL(contact.instagram_url).pathname.replace(/^\//, '').split('/')[0]}</span>
                            )}
                            {contact.linkedin_url && (
                              <span className="flex items-center gap-1"><Linkedin className="h-3 w-3 text-blue-700" />{new URL(contact.linkedin_url).pathname.replace(/^\//, '').split('/')[0]}</span>
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
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                        <button
                          onClick={() => {
                            if (isLocked) return;
                            void updateContact(contact.id, { review_status: contact.review_status === 'seen' ? 'unseen' : 'seen' }).then(() => { void refreshContacts(); void refreshKpi(); });
                          }}
                          className="focus:outline-none disabled:opacity-50"
                          disabled={isLocked}
                        >
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
                        <Switch
                          checked={contact.approval}
                          onCheckedChange={() => { if (!isLocked) void handleToggleApproval(contact); }}
                          aria-label="Toggle approval"
                          disabled={isLocked}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                        <button
                          onClick={() => { if (!isLocked) void handleToggleContacted(contact); }}
                          className="focus:outline-none inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
                          disabled={isLocked}
                        >
                          {contact.contacted ? <Check className="h-5 w-5 text-emerald-600" /> : <X className="h-5 w-5 text-red-400" />}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {contact.assigned_to ? (
                          <span className="truncate max-w-[140px] inline-block" title={contact.assigned_to}>
                            {contact.assigned_to === userEmail ? 'Tu' : contact.assigned_to}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLocked} onClick={() => {
                            if (contact.instagram_url) window.open(contact.instagram_url, '_blank', 'noopener,noreferrer');
                          }}>
                            <Instagram className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLocked} onClick={() => {
                            if (contact.linkedin_url) window.open(contact.linkedin_url, '_blank', 'noopener,noreferrer');
                          }}>
                            <Linkedin className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {renderPagination()}
        </div>
      </main>

      <OperatorContactDrawer
        contact={selectedContact}
        sources={selectedSources}
        userEmail={userEmail}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSave}
        onReadyToContact={() => {
          if (selectedContact) void handleReadyToContact();
        }}
        onClaimSingle={() => {
          if (selectedContact) void handleClaimSingle();
        }}
        saving={false}
      />
    </div>
  );
}
