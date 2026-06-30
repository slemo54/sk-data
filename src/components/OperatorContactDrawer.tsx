import { useState, useEffect } from 'react';
import type { Contact, ContactSource, ContactPatch, ViaSourcePatch } from '@/types/contact';
import { getSourceLabel, isBuyerSource, isViaDbSource, isVinitalyCanadaSource } from '@/lib/contactSourceDisplay';
import { buildLocationSuggestions } from '@/lib/locationSuggestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Lock, ExternalLink, MapPin, User, Building2, Briefcase, FileText, Trash2 } from 'lucide-react';

interface Props {
  contact: Contact | null;
  sources: ContactSource[];
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: ContactPatch) => void;
  onSaveVia?: (patch: ViaSourcePatch) => void;
  onReadyToContact: () => void;
  onClaimSingle: () => void;
  onRelease?: () => void;
  onDelete?: () => void;
  saving: boolean;
  cities?: string[];
}

function sourceValue(source: ContactSource, key: string): string | null {
  const value = source.raw_data?.[key];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export default function OperatorContactDrawer({
  contact,
  sources,
  userEmail,
  open,
  onOpenChange,
  onSave,
  onSaveVia,
  onReadyToContact,
  onClaimSingle,
  onRelease,
  onDelete,
  saving,
  cities = [],
}: Props) {
  const [draft, setDraft] = useState<ContactPatch>({});
  const [viaDraft, setViaDraft] = useState<ViaSourcePatch>({});

  const viaSource = sources.find(isViaDbSource);

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
      city: contact.city,
      notes: contact.notes,
    });
  }, [contact]);

  useEffect(() => {
    setViaDraft({
      year: viaSource ? sourceValue(viaSource, 'via_year') : null,
      courseClass: viaSource ? sourceValue(viaSource, 'via_course_class') ?? viaSource.wine_role : null,
      phone: viaSource ? sourceValue(viaSource, 'via_phone') : null,
      iwaIwe: viaSource ? sourceValue(viaSource, 'via_iwa_iwe') : null,
    });
  }, [viaSource]);

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
    (draft.city ?? '') !== (contact.city ?? '') ||
    (draft.notes ?? '') !== (contact.notes ?? '')
  );

  const isViaDirty = (
    (viaDraft.year ?? '') !== (viaSource ? sourceValue(viaSource, 'via_year') ?? '' : '') ||
    (viaDraft.courseClass ?? '') !== (viaSource ? sourceValue(viaSource, 'via_course_class') ?? viaSource.wine_role ?? '' : '') ||
    (viaDraft.phone ?? '') !== (viaSource ? sourceValue(viaSource, 'via_phone') ?? '' : '') ||
    (viaDraft.iwaIwe ?? '') !== (viaSource ? sourceValue(viaSource, 'via_iwa_iwe') ?? '' : '')
  );

  const canReadyToContact = Boolean(
    contact.instagram_url || contact.linkedin_url || contact.email ||
    draft.instagram_url || draft.linkedin_url || draft.email,
  );
  const locationSuggestions = buildLocationSuggestions(cities);

  const setField = (field: keyof ContactPatch, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const setViaField = (field: keyof ViaSourcePatch, value: string) => {
    setViaDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (isLocked) return;
    if (isDirty) {
      const patch: ContactPatch = {
        first_name: draft.first_name?.trim() || null,
        last_name: draft.last_name?.trim() || null,
        email: draft.email?.trim() || null,
        instagram_url: draft.instagram_url?.trim() || null,
        linkedin_url: draft.linkedin_url?.trim() || null,
        employer: draft.employer?.trim() || null,
        title: draft.title?.trim() || null,
        occupation: draft.occupation?.trim() || null,
        city: draft.city?.trim() || null,
        notes: draft.notes?.trim() || null,
      };
      onSave(patch);
    }
    if (isViaDirty) {
      onSaveVia?.({
        year: viaDraft.year?.trim() || null,
        courseClass: viaDraft.courseClass?.trim() || null,
        phone: viaDraft.phone?.trim() || null,
        iwaIwe: viaDraft.iwaIwe?.trim() || null,
      });
    }
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
                <Input
                  list="operator-contact-cities"
                  placeholder="Città, stato o paese..."
                  value={draft.city ?? ''}
                  onChange={(e) => setField('city', e.target.value)}
                  disabled={isLocked}
                  className="h-8 text-xs"
                />
                <datalist id="operator-contact-cities">
                  {locationSuggestions.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>
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

          {/* VIA DB */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">VIA DB</h3>
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Year</span>
                  <Input
                    value={viaDraft.year ?? ''}
                    onChange={(e) => setViaField('year', e.target.value)}
                    disabled={isLocked}
                    placeholder="es. 2026"
                    className="h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Course/class</span>
                  <Input
                    value={viaDraft.courseClass ?? ''}
                    onChange={(e) => setViaField('courseClass', e.target.value)}
                    disabled={isLocked}
                    placeholder="es. VERONA 2026"
                    className="h-10"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</span>
                  <Input
                    value={viaDraft.phone ?? ''}
                    onChange={(e) => setViaField('phone', e.target.value)}
                    disabled={isLocked}
                    placeholder="Telefono"
                    className="h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">IWA/IWE</span>
                  <Input
                    value={viaDraft.iwaIwe ?? ''}
                    onChange={(e) => setViaField('iwaIwe', e.target.value)}
                    disabled={isLocked}
                    placeholder="IWA o IWE"
                    className="h-10"
                  />
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
          {(isDirty || isViaDirty) && (
            <div className="text-xs text-amber-600 font-medium">
              Modifiche non salvate
            </div>
          )}

          {/* Bottoni */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || isLocked || (!isDirty && !isViaDirty)} className="flex-1">
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
                    <div className="font-medium">{getSourceLabel(source.source, source)}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {source.restaurant_name ?? '-'} · {source.award ?? '-'} · {source.wine_role ?? '-'}
                    </div>
                    {isViaDbSource(source) && (
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Year</span>
                        <span>{sourceValue(source, 'via_year') ?? '-'}</span>
                        <span className="text-muted-foreground">Course/class</span>
                        <span>{sourceValue(source, 'via_course_class') ?? '-'}</span>
                        <span className="text-muted-foreground">Phone</span>
                        <span>{sourceValue(source, 'via_phone') ?? '-'}</span>
                        <span className="text-muted-foreground">IWA/IWE</span>
                        <span>{sourceValue(source, 'via_iwa_iwe') ?? '-'}</span>
                      </div>
                    )}
                    {(isBuyerSource(source) || isVinitalyCanadaSource(source)) && (
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Categoria</span>
                        <span>{sourceValue(source, 'category') ?? '-'}</span>
                        <span className="text-muted-foreground">File</span>
                        <span>{sourceValue(source, 'source_file') ?? '-'}</span>
                        <span className="text-muted-foreground">Evento</span>
                        <span>{sourceValue(source, 'event') ?? '-'}</span>
                        <span className="text-muted-foreground">Phone</span>
                        <span>{sourceValue(source, 'phone') ?? '-'}</span>
                        <span className="text-muted-foreground">Web/address</span>
                        <span>{sourceValue(source, 'website') ?? sourceValue(source, 'address') ?? '-'}</span>
                      </div>
                    )}
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
