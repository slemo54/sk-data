# Report di Configurazione Progetto - SK DATABASE

Questo documento riassume le attività eseguite per la messa in produzione e il setup dell'ambiente di sviluppo per l'applicazione SK DATABASE.

## 1. Source Control (GitHub)
- **Repository:** `https://github.com/slemo54/sk-data`
- **Branch principale:** `main`
- **Operazioni eseguite:**
    - Inizializzazione Git locale.
    - Collegamento al remote e push forzato per allineare il codice sorgente.
    - Configurazione del file `.gitignore` per escludere file sensibili (`.env`) e directory di build.

## 2. Backend & Database (Supabase)
- **Project Reference:** `ershbxnajqfqcxeisgqg`
- **URL API:** `https://ershbxnajqfqcxeisgqg.supabase.co`
- **Configurazione:**
    - Setup del server MCP Supabase per integrazione con l'AI.
    - Definizione dello schema database in `supabase/schema.sql` (Tabelle: `contacts`, `contact_sources`, `profiles_review_log`).
    - Configurazione delle Row Level Security (RLS) e delle policy di accesso per operatori.
    - Implementazione della funzione PostgreSQL `claim_contacts` per la gestione dei batch di lavoro.

## 3. Hosting & Deployment (Vercel)
- **Project Name:** `sk-database`
- **Project ID:** `prj_UJ4jqUhW2EgfLAmI4MuJUDuqtWH7`
- **Ottimizzazioni Build:**
    - Creato file `vercel.json` per specificare la directory di output `dist` (standard per Vite).
    - Risolto errore di "Missing Output Directory".
- **CI/CD:** Il deployment è ora automatizzato tramite l'integrazione GitHub; ogni push sul branch `main` triggera una nuova build.

## 4. Variabili d'Ambiente (.env)
Le seguenti variabili devono essere configurate nel pannello **Settings > Environment Variables** di Vercel:
- `VITE_SUPABASE_URL`: URL del progetto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Chiave pubblica anonima.

*Nota: Il file `.env` locale è stato rimosso dal repository GitHub per motivi di sicurezza e per evitare conflitti con le impostazioni di produzione.*

## 5. Prossimi Passi Consigliati
1. **Popolamento Dati:** Eseguire lo script di importazione contatti:
   ```bash
   node scripts/import-contacts.mjs --guildsomm <file.csv> --apply
   ```
2. **Verifica Database:** Assicurarsi che lo script `supabase/schema.sql` sia stato eseguito nell'Editor SQL di Supabase per attivare le tabelle.
