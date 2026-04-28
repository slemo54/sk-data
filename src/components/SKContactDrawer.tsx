import { useState } from 'react';
import type { Contact, ContactSource, NextAction } from '@/types/contact';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Trash2,
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
  onDelete?: () => void;
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

export default function SKContactDrawer({
  contact,
  sources,
  open,
  onOpenChange,
  onUpdateNextAction,
  onDelete,
}: Props) {
  const [savingNextAction, setSavingNextAction] = useState(false);

  if (!contact) return null;

  const handleNextActionChange = async (value: string) => {
    const nextAction = value === 'none' ? null : (value as NextAction);
    setSavingNextAction(true);
    try {
      await onUpdateNextAction(nextAction);
    } finally {
      setSavingNextAction(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-[1%]">
        <SheetHeader>
          <SheetTitle>Person Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Nome e location con avatar */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
              <User className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{contact.full_name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {[contact.city, contact.country].filter(Boolean).join(', ') || 'Località non disponibile'}
              </p>
            </div>
          </div>

          {/* Social Cards */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Social</h3>
            <div className="grid grid-cols-3 gap-2">
              {/* Instagram */}
              {contact.instagram_url ? (
                <a
                  href={contact.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 hover:bg-accent/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Instagram className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">Instagram</p>
                  <p className="text-[10px] text-primary truncate w-full">Linked</p>
                </a>
              ) : (
                <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 opacity-60">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Instagram className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">Instagram</p>
                  <p className="text-[10px] text-muted-foreground">Not linked</p>
                </div>
              )}

              {/* LinkedIn */}
              {contact.linkedin_url ? (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 hover:bg-accent/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Linkedin className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">LinkedIn</p>
                  <p className="text-[10px] text-primary truncate w-full">Linked</p>
                </a>
              ) : (
                <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 opacity-60">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Linkedin className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">LinkedIn</p>
                  <p className="text-[10px] text-muted-foreground">Not linked</p>
                </div>
              )}

              {/* Email */}
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 hover:bg-accent/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">Email</p>
                  <p className="text-[10px] text-primary truncate w-full">Linked</p>
                </a>
              ) : (
                <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-1 opacity-60">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">Email</p>
                  <p className="text-[10px] text-muted-foreground">Not linked</p>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Info</h3>
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Employer</p>
                  <p className="text-sm font-medium">{contact.employer ?? '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Title / Occupation</p>
                  <p className="text-sm font-medium">{[contact.title, contact.occupation].filter(Boolean).join(' / ') || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</h3>
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Workflow operatore</span>
                <Badge variant="outline" className={statusBadge(contact.status)}>
                  {statusLabel(contact.status)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Visto da SK</span>
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
                <span className="text-sm">Approvato</span>
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
                <span className="text-sm">Contattato</span>
                {contact.contacted ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Sì
                  </Badge>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" /> No
                  </span>
                )}
              </div>
              {contact.assigned_to && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Assegnato a</span>
                  <span className="text-sm font-medium">{contact.assigned_to}</span>
                </div>
              )}
            </div>
          </div>

          {/* Next Action — SK */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Next Action (SK)</h3>
            <div className="rounded-xl border bg-card p-4">
              <Select
                value={contact.next_action ?? 'none'}
                onValueChange={handleNextActionChange}
                disabled={savingNextAction}
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
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Note operatore
            </h3>
            <div className={`rounded-xl border p-4 text-sm ${contact.notes ? 'bg-amber-50 text-amber-900' : 'bg-muted/30 text-muted-foreground italic'}`}>
              {contact.notes ?? 'Nessuna nota'}
            </div>
          </div>

          {/* Delete */}
          {onDelete && (
            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Elimina contatto
              </Button>
            </div>
          )}

          {/* Source */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Source</h3>
            {!sources.length && <p className="text-sm text-muted-foreground">Nessuna provenance disponibile.</p>}
            {!!sources.length && (
              <div className="space-y-2">
                {sources.map((source) => (
                  <div key={source.id} className="text-sm border rounded-xl p-3 bg-muted/30">
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
