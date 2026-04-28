import { useState } from 'react';
import type { ContactCreate } from '@/types/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Building2,
  Briefcase,
  FileText,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  User,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: ContactCreate) => void;
  saving: boolean;
}

export default function OperatorCreateContactDrawer({ open, onOpenChange, onCreate, saving }: Props) {
  const [draft, setDraft] = useState<ContactCreate>({
    full_name: '',
    email: '',
    instagram_url: '',
    linkedin_url: '',
    employer: '',
    title: '',
    occupation: '',
    city: '',
    country: '',
    notes: '',
  });

  const setField = (field: keyof ContactCreate, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const name = draft.full_name.trim();
    if (!name) return;
    onCreate({
      ...draft,
      full_name: name,
      email: draft.email?.trim() || null,
      instagram_url: draft.instagram_url?.trim() || null,
      linkedin_url: draft.linkedin_url?.trim() || null,
      employer: draft.employer?.trim() || null,
      title: draft.title?.trim() || null,
      occupation: draft.occupation?.trim() || null,
      city: draft.city?.trim() || null,
      country: draft.country?.trim() || null,
      notes: draft.notes?.trim() || null,
    });
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setDraft({
        full_name: '',
        email: '',
        instagram_url: '',
        linkedin_url: '',
        employer: '',
        title: '',
        occupation: '',
        city: '',
        country: '',
        notes: '',
      });
    }
    onOpenChange(val);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-[1%]">
        <SheetHeader>
          <SheetTitle>Aggiungi contatto</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5 px-2 pb-8">
          {/* Avatar + Nome */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
              <User className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <Input
                placeholder="Nome completo *"
                value={draft.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                className="h-10"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <Input
                  placeholder="Città"
                  value={draft.city ?? ''}
                  onChange={(e) => setField('city', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Paese"
                  value={draft.country ?? ''}
                  onChange={(e) => setField('country', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Social */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Social</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <Instagram className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">Instagram</p>
                <Input
                  placeholder="URL"
                  value={draft.instagram_url ?? ''}
                  onChange={(e) => setField('instagram_url', e.target.value)}
                  className="h-7 text-[10px] px-2"
                />
              </div>
              <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <Linkedin className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">LinkedIn</p>
                <Input
                  placeholder="URL"
                  value={draft.linkedin_url ?? ''}
                  onChange={(e) => setField('linkedin_url', e.target.value)}
                  className="h-7 text-[10px] px-2"
                />
              </div>
              <div className="rounded-xl border bg-card p-3 flex flex-col items-center text-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <Mail className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">Email</p>
                <Input
                  placeholder="Email"
                  value={draft.email ?? ''}
                  onChange={(e) => setField('email', e.target.value)}
                  className="h-7 text-[10px] px-2"
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Info</h3>
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Employer</p>
                  <Input
                    placeholder="Ristorante / Azienda"
                    value={draft.employer ?? ''}
                    onChange={(e) => setField('employer', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Title</p>
                    <Input
                      placeholder="Titolo"
                      value={draft.title ?? ''}
                      onChange={(e) => setField('title', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Occupation</p>
                    <Input
                      placeholder="Ruolo"
                      value={draft.occupation ?? ''}
                      onChange={(e) => setField('occupation', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Note operatore
            </h3>
            <Textarea
              value={draft.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Scrivi le tue note qui..."
              className="min-h-[80px]"
            />
          </div>

          {/* Bottoni */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !draft.full_name.trim()} className="flex-1">
              {saving ? 'Salvataggio...' : 'Salva contatto'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
