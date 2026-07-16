import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { toast } from 'sonner';
import {
  fetchAllContacts,
  fetchContactChannelCounts,
  type ContactChannelCounts,
  type ContactLoadProgress,
} from '@/lib/contactsService';
import { downloadContactsCsv } from '@/lib/contactExport';
import type { Contact, ContactSort, ContactsFilters } from '@/types/contact';

const EMPTY_COUNTS: ContactChannelCounts = {
  instagram: 0,
  linkedin: 0,
  email: 0,
};

const ROW_HEIGHT = 72;
const VIEWPORT_HEIGHT = 720;
const OVERSCAN = 8;

interface UseContactResultToolsOptions {
  contacts: Contact[];
  total: number;
  filters: ContactsFilters;
  sort: ContactSort;
  dataVersion: number;
}

export function useContactResultTools({
  contacts,
  total,
  filters,
  sort,
  dataVersion,
}: UseContactResultToolsOptions) {
  const [showAll, setShowAll] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAllLoading, setShowAllLoading] = useState(false);
  const [showAllProgress, setShowAllProgress] = useState<ContactLoadProgress>({
    loaded: 0,
    total: 0,
  });
  const [channelCounts, setChannelCounts] = useState<ContactChannelCounts>(EMPTY_COUNTS);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ContactLoadProgress>({
    loaded: 0,
    total: 0,
  });
  const showAllController = useRef<AbortController | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const previousDataVersion = useRef(dataVersion);

  const loadAll = useCallback(async () => {
    showAllController.current?.abort();
    const controller = new AbortController();
    showAllController.current = controller;
    setShowAllLoading(true);
    setShowAllProgress({ loaded: 0, total });

    try {
      const rows = await fetchAllContacts(
        filters,
        sort,
        controller.signal,
        (progress, loadedRows) => {
          setShowAllProgress(progress);
          setAllContacts(loadedRows);
        },
      );
      setAllContacts(rows);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setShowAll(false);
        toast.error((error as Error).message || 'Impossibile caricare tutti i contatti');
      }
    } finally {
      if (showAllController.current === controller) {
        setShowAllLoading(false);
      }
    }
  }, [filters, sort, total]);

  useEffect(() => {
    showAllController.current?.abort();
    setShowAll(false);
    setAllContacts([]);
    setShowAllLoading(false);
    setShowAllProgress({ loaded: 0, total: 0 });
  }, [filters, sort]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchContactChannelCounts(filters, controller.signal)
      .then(setChannelCounts)
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          console.error('Errore conteggio canali', error);
        }
      });

    return () => controller.abort();
  }, [filters]);

  useEffect(() => {
    if (previousDataVersion.current === dataVersion) return;
    previousDataVersion.current = dataVersion;
    if (showAll) void loadAll();
  }, [dataVersion, loadAll, showAll]);

  useEffect(() => {
    return () => {
      showAllController.current?.abort();
      exportController.current?.abort();
    };
  }, []);

  const toggleShowAll = useCallback(() => {
    if (showAll) {
      showAllController.current?.abort();
      setShowAll(false);
      setAllContacts([]);
      setShowAllLoading(false);
      return;
    }

    setShowAll(true);
    void loadAll();
  }, [loadAll, showAll]);

  const exportCsv = useCallback(async () => {
    if (exporting) return;

    setExporting(true);
    setExportProgress({ loaded: 0, total });
    const controller = new AbortController();
    exportController.current = controller;

    try {
      const rows =
        showAll && !showAllLoading && allContacts.length === total
          ? allContacts
          : await fetchAllContacts(filters, sort, controller.signal, (progress) => {
              setExportProgress(progress);
            });
      downloadContactsCsv(rows);
      toast.success(`${rows.length.toLocaleString('it-IT')} contatti esportati`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error((error as Error).message || 'Export CSV fallito');
      }
    } finally {
      if (exportController.current === controller) {
        setExporting(false);
      }
    }
  }, [
    allContacts,
    exporting,
    filters,
    showAll,
    showAllLoading,
    sort,
    total,
  ]);

  return {
    channelCounts,
    contacts: showAll ? allContacts : contacts,
    exportCsv,
    exporting,
    exportProgress,
    showAll,
    showAllLoading,
    showAllProgress,
    toggleShowAll,
  };
}

export function useVirtualContactRows(contacts: Contact[], enabled: boolean) {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
  }, [enabled]);

  const window = useMemo(() => {
    if (!enabled) {
      return {
        rows: contacts,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }

    const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT);
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(contacts.length, start + visibleCount + OVERSCAN * 2);

    return {
      rows: contacts.slice(start, end),
      topSpacer: start * ROW_HEIGHT,
      bottomSpacer: Math.max(0, (contacts.length - end) * ROW_HEIGHT),
    };
  }, [contacts, enabled, scrollTop]);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    ...window,
    onScroll,
    viewportHeight: VIEWPORT_HEIGHT,
  };
}
