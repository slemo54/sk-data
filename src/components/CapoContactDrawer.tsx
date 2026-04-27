import type { Contact, ContactSource, NextAction } from '@/types/contact';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Building2,
  Briefcase,
  ExternalLink,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  // Eye, EyeOff removed as unused
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';

const ADMIN_NEXT_ACTION_OPTIONS: { value: NextAction; label: string }[] = [
  { value: 'da_approvare', label: 'Da approvare' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'contattato', label: 'Contattato' },
  { value: 'da_verificare', label: 'Da verificare' },
  { value: 'chiuso', label: 'Chiuso' },
];

interface Props {
  contact: Contact | null;
  sources: ContactSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateNextAction: (nextAction: NextAction | null) => void;
}

function statusBadge(status: string) {
  switch (status) {
    case 'todo':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'reviewed':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function statusLabel(status: string) {
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

export default function CapoContactDrawer({ contact, sources, open, onOpenChange, onUpdateNextAction }: Props) {
  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-[1%]">
        <SheetHeader>
          <SheetTitle>Dettaglio Persona</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Nome e location */}
          <div>
            <h2 className="text-xl font-bold">{contact.full_name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {[contact.city, contact.country].filter(Boolean).join(', ') || 'Località non disponibile'}
            </p>
          </div>

          {/* Social Cards */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social</h3>
            <div className="grid grid-cols-1 gap-2">
              {contact.instagram_url ? (
                <a
                  href={contact.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                    <Instagram className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Instagram</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.instagram_url}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 opacity-60">
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Instagram className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Instagram</p>
                    <p className="text-xs text-muted-foreground">Non trovato</p>
                  </div>
                </div>
              )}

              {contact.linkedin_url ? (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <Linkedin className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">LinkedIn</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.linkedin_url}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 opacity-60">
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Linkedin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">LinkedIn</p>
                    <p className="text-xs text-muted-foreground">Non trovato</p>
                  </div>
                </div>
              )}

              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Email</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 opacity-60">
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-xs text-muted-foreground">Non trovato</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Info</h3>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Employer</p>
                  <p className="text-sm font-medium">{contact.employer ?? '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Title / Occupation</p>
                  <p className="text-sm font-medium">{[contact.title, contact.occupation].filter(Boolean).join(' / ') || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stato */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Stato</h3>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Workflow operatore</span>
                <Badge variant="outline" className={statusBadge(contact.status)}>
                  {statusLabel(contact.status)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Visto dal capo</span>
                <Badge
                  variant="outline"
                  className={
                    contact.review_status === 'seen'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }
                >
                  {contact.review_status === 'seen' ? 'Visto' : 'Non visto'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Approvato</span>
                {contact.approval ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Sì
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" /> No
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contattato</span>
                {contact.contacted ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Sì
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" /> No
                  </span>
                )}
              </div>
              {contact.assigned_to && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assegnato a</span>
                  <span className="text-sm font-medium">{contact.assigned_to}</span>
                </div>
              )}
            </div>
          </div>

          {/* Next Action — solo admin */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Next Action (Capo)</h3>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Select
                value={contact.next_action ?? 'none'}
                onValueChange={(v) => onUpdateNextAction(v === 'none' ? null : (v as NextAction))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona azione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ADMIN_NEXT_ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note operatore */}
          {contact.notes && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Note operatore
              </h3>
              <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
                {contact.notes}
              </div>
            </div>
          )}

          {/* Provenienze */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Provenienze</h3>
            {!sources.length && <p className="text-sm text-muted-foreground">Nessuna provenance disponibile.</p>}
            {!!sources.length && (
              <div className="space-y-2">
                {sources.map((source) => (
                  <div key={source.id} className="text-sm border rounded-lg p-3 bg-muted/30">
                    <div className="font-medium capitalize">{source.source.replace('_', ' ')}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {source.restaurant_name ?? '-'} · {source.award ?? '-'} · {source.wine_role ?? '-'}
                    </div>
                    {source.profile_url && (
                      <a
                        href={source.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline mt-1 inline-flex items-center gap-1"
                      >
                        Profilo <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
