import { useState, useEffect } from 'react';
import type { Contact, ContactSource, ContactPatch } from '@/types/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Lock, ExternalLink, MapPin, User, Building2, Briefcase, FileText, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  contact: Contact | null;
  sources: ContactSource[];
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: ContactPatch) => void;
  onReadyToContact: () => void;
  onClaimSingle: () => void;
  onRelease?: () => void;
  onDelete?: () => void;
  saving: boolean;
  cities?: string[];
}

export default function OperatorContactDrawer({
  contact,
  sources,
  userEmail,
  open,
  onOpenChange,
  onSave,
  onReadyToContact,
  onClaimSingle,
  onRelease,
  onDelete,
  saving,
  cities = [],
}: Props) {
  const [draft, setDraft] = useState<ContactPatch>({});
  const [cityOpen, setCityOpen] = useState(false);

  useEffect(() => {
    if (!contact) {
      setDraft({});
      return;
    }
    setDraft({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      instagram_url: contact.instagram_url,
      linkedin_url: contact.linkedin_url,
      employer: contact.employer,
      title: contact.title,
      occupation: contact.occupation,
      notes: contact.notes,
    });
  }, [contact]);

  if (!contact) return null;

  const isMine = contact.assigned_to === userEmail;
  const isLocked = !isMine;

  const isDirty = (
    (draft.first_name ?? '') !== (contact.first_name ?? '') ||
    (draft.last_name ?? '') !== (contact.last_name ?? '') ||
    (draft.email ?? '') !== (contact.email ?? '') ||
    (draft.instagram_url ?? '') !== (contact.instagram_url ?? '') ||
    (draft.linkedin_url ?? '') !== (contact.linkedin_url ?? '') ||
    (draft.employer ?? '') !== (contact.employer ?? '') ||
    (draft.title ?? '') !== (contact.title ?? '') ||
    (draft.occupation ?? '') !== (contact.occupation ?? '') ||
    (draft.notes ?? '') !== (contact.notes ?? '')
  );

  const canReadyToContact = Boolean(
    contact.instagram_url || contact.linkedin_url || contact.email ||
    draft.instagram_url || draft.linkedin_url || draft.email,
  );

  const setField = (field: keyof ContactPatch, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (isLocked) return;
    const patch: ContactPatch = {
      first_name: draft.first_name?.trim() || null,
      last_name: draft.last_name?.trim() || null,
      email: draft.email?.trim() || null,
      instagram_url: draft.instagram_url?.trim() || null,
      linkedin_url: draft.linkedin_url?.trim() || null,
      employer: draft.employer?.trim() || null,
      title: draft.title?.trim() || null,
      occupation: draft.occupation?.trim() || null,
      notes: draft.notes?.trim() || null,
    };
    onSave(patch);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-[1%]">
        <SheetHeader>
          <SheetTitle>Person Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5 px-2 pb-8">
          {/* Avatar + Nome + Location */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
              <User className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nome"
                  value={draft.first_name ?? ''}
                  onChange={(e) => setField('first_name', e.target.value)}
                  disabled={isLocked}
                  className="h-9"
                />
                <Input
                  placeholder="Cognome"
                  value={draft.last_name ?? ''}
                  onChange={(e) => setField('last_name', e.target.value)}
                  disabled={isLocked}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Popover open={cityOpen} onOpenChange={setCityOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={cityOpen}
                      className="w-full justify-between h-8 text-xs font-normal"
                      disabled={isLocked}
                    >
                      {draft.city || 'Seleziona o digita città...'}
                      <span className="ml-2 opacity-50">⌄</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Cerca città..." />
                      <CommandList>
                        <CommandEmpty>Nessuna città trovata. Scrivi per aggiungere.</CommandEmpty>
                        <CommandGroup>
                          {cities.map((city) => (
                            <CommandItem
                              key={city}
                              value={city}
                              onSelect={() => {
                                setField('city', city);
                                setCityOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  draft.city === city ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {city}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Banner locked */}
          {isLocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 text-sm text-amber-800">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0" />
                <span>
                  {contact.assigned_to
                    ? `Contatto assegnato a ${contact.assigned_to}`
                    : 'Contatto non assegnato'}
                </span>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={onClaimSingle}>
                Claim questo contatto
              </Button>
            </div>
          )}

          {/* Social */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Social</h3>
            <div className="rounded-xl border bg-card p-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</span>
                <Input value={draft.email ?? ''} onChange={(e) => setField('email', e.target.value)} disabled={isLocked} className="h-9" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">LinkedIn</span>
                <Input value={draft.linkedin_url ?? ''} onChange={(e) => setField('linkedin_url', e.target.value)} disabled={isLocked} className="h-9" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Instagram</span>
                <Input value={draft.instagram_url ?? ''} onChange={(e) => setField('instagram_url', e.target.value)} disabled={isLocked} className="h-9" />
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Twitter</span>
                <Input value="" disabled placeholder="Non supportato" className="h-9" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Info</h3>
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Employer
                </span>
                <Input value={draft.employer ?? ''} onChange={(e) => setField('employer', e.target.value)} disabled={isLocked} className="h-9" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Title
                  </span>
                  <Input value={draft.title ?? ''} onChange={(e) => setField('title', e.target.value)} disabled={isLocked} className="h-9" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Occupation</span>
                  <Input value={draft.occupation ?? ''} onChange={(e) => setField('occupation', e.target.value)} disabled={isLocked} className="h-9" />
                </label>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" /> Note
            </h3>
            <div className="rounded-xl border bg-card p-3">
              <textarea
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-y"
                value={draft.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={isLocked}
                placeholder="Scrivi le tue note qui..."
              />
            </div>
          </div>

          {/* Dirty indicator */}
          {isDirty && (
            <div className="text-xs text-amber-600 font-medium">
              Modifiche non salvate
            </div>
          )}

          {/* Bottoni */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || isLocked || !isDirty} className="flex-1">
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
            <Button
              variant="outline"
              onClick={onReadyToContact}
              disabled={isLocked || contact.next_action === 'pronto_da_contattare' || !canReadyToContact}
              className="flex-1"
              title={!canReadyToContact ? 'Aggiungi almeno un social o un\'email' : undefined}
            >
              Pronto a contattare
            </Button>
          </div>

          {/* Release + Delete */}
          {isMine && (
            <div className="flex items-center gap-3 pt-1">
              {onRelease && (
                <Button variant="outline" size="sm" className="flex-1" onClick={onRelease}>
                  Rilascia contatto
                </Button>
              )}
              {onDelete && (
                <Button variant="outline" size="sm" className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              )}
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
                      <a href={source.profile_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-flex items-center gap-1">
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
