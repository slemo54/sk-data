import { useState, useEffect } from 'react';
import type { Contact, ContactSource, ContactPatch, NextAction } from '@/types/contact';
// import { Badge } from '@/components/ui/badge';
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
import { Lock, ExternalLink } from 'lucide-react';

const NEXT_ACTION_OPTIONS: { value: NextAction; label: string }[] = [
  { value: 'pronto_da_contattare', label: 'Pronto da contattare' },
  { value: 'da_approvare', label: 'Da approvare' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'contattato', label: 'Contattato' },
  { value: 'da_verificare', label: 'Da verificare' },
  { value: 'chiuso', label: 'Chiuso' },
];

interface Props {
  contact: Contact | null;
  sources: ContactSource[];
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: ContactPatch) => void;
  onStatusAdvance: () => void;
  saving: boolean;
}

export default function OperatorContactDrawer({
  contact,
  sources,
  userEmail,
  open,
  onOpenChange,
  onSave,
  onStatusAdvance,
  saving,
}: Props) {
  const [draft, setDraft] = useState<ContactPatch>({});

  useEffect(() => {
    if (!contact) {
      setDraft({});
      return;
    }
    setDraft({
      email: contact.email,
      instagram_url: contact.instagram_url,
      linkedin_url: contact.linkedin_url,
      employer: contact.employer,
      title: contact.title,
      occupation: contact.occupation,
      next_action: contact.next_action,
      notes: contact.notes,
    });
  }, [contact]);

  if (!contact) return null;

  const isMine = contact.assigned_to === userEmail;
  const isLocked = !isMine;

  const setField = (field: keyof ContactPatch, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (isLocked) return;
    const patch: ContactPatch = {
      email: draft.email?.trim() || null,
      instagram_url: draft.instagram_url?.trim() || null,
      linkedin_url: draft.linkedin_url?.trim() || null,
      employer: draft.employer?.trim() || null,
      title: draft.title?.trim() || null,
      occupation: draft.occupation?.trim() || null,
      next_action: draft.next_action ?? null,
      notes: draft.notes?.trim() || null,
    };
    onSave(patch);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Dettaglio Persona</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {isLocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
              <Lock className="h-4 w-4 shrink-0" />
              <span>
                {contact.assigned_to
                  ? `Contatto bloccato. È assegnato a ${contact.assigned_to}. Fai claim per modificare.`
                  : 'Contatto bloccato. Fai claim per poterlo modificare.'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email</span>
              <Input value={draft.email ?? ''} onChange={(e) => setField('email', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Instagram</span>
              <Input value={draft.instagram_url ?? ''} onChange={(e) => setField('instagram_url', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">LinkedIn</span>
              <Input value={draft.linkedin_url ?? ''} onChange={(e) => setField('linkedin_url', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Employer</span>
              <Input value={draft.employer ?? ''} onChange={(e) => setField('employer', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Title</span>
              <Input value={draft.title ?? ''} onChange={(e) => setField('title', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Occupation</span>
              <Input value={draft.occupation ?? ''} onChange={(e) => setField('occupation', e.target.value)} disabled={isLocked} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Next Action</span>
              <Select
                value={draft.next_action ?? 'none'}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, next_action: v === 'none' ? null : (v as NextAction) }))}
                disabled={isLocked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona azione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {NEXT_ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Note</span>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                value={draft.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={isLocked}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || isLocked}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
            <Button variant="outline" size="sm" onClick={onStatusAdvance} disabled={isLocked}>
              Avanza stato ({contact.status})
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Provenienze</h3>
            {!sources.length && <p className="text-sm text-muted-foreground">Nessuna provenance disponibile.</p>}
            {!!sources.length && (
              <ul className="flex flex-col gap-2">
                {sources.map((source) => (
                  <li key={source.id} className="text-sm border rounded-lg p-3 bg-muted/30">
                    <div className="font-medium capitalize">{source.source.replace('_', ' ')}</div>
                    <div className="text-muted-foreground">{source.restaurant_name ?? '-'} · {source.award ?? '-'} · {source.wine_role ?? '-'}</div>
                    {source.profile_url && (
                      <a href={source.profile_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
                        Profilo <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
