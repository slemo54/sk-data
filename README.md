# SK DATABASE

Dashboard persone-first per workflow operativo su contatti unificati:
- Wine Awards (`src/data/restaurants.json`)
- GuildSomm CSV (`Scraped Profiles Only`)

## Setup

1. Installa dipendenze:
```bash
npm install
```

2. Configura le variabili d'ambiente:
   - Su **Vercel**: Vai in Settings > Environment Variables e inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
   - In **Locale**: Crea un file `.env` (non incluso nel repository) con i valori del tuo progetto Supabase.

3. Applica schema SQL in Supabase con [`supabase/schema.sql`](supabase/schema.sql).

4. Avvia UI:
```bash
npm run dev
```

## Import Iniziale (merge deterministico)

Genera preview locale da dataset Wine Awards + CSV GuildSomm:
```bash
npm run import:contacts -- --guildsomm /percorso/Scraped_Profiles_Only.csv
```

Scrive `tmp/contacts-merged-preview.json` con summary + record unificati.

Per caricare su Supabase:
```bash
SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npm run import:contacts -- --guildsomm /percorso/Scraped_Profiles_Only.csv --apply
```

Regola merge: solo su `normalized_name + country + city`.

## Workflow Dashboard

- Filtri: testo, paese, source, social/email, stato, assegnazione.
- `Claim N`: prende un batch di record non assegnati.
- Stati: `todo -> in_progress -> reviewed`.
- Dettaglio persona: modifica social/email/employer/title/occupation.
- Provenance: mostra fonti `contact_sources` (ristorante/award/profile).
