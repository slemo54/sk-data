# SK DATABASE — Guida Completa

---


## 📋 PER ME (Proprietario / Admin Tecnico)

### Cosa è SK DATABASE
Applicazione web per gestire contatti del mondo wine (sommelier, wine director, etc.) provenienti da due fonti:
- **Wine Awards** (`restaurants.json`) — ristoranti premiati e il loro staff
- **GuildSomm** (CSV) — profili iscritti alla piattaforma GuildSomm

### Stack Tecnico
- **Frontend:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3.4 + shadcn/ui
- **Backend / DB:** Supabase (PostgreSQL + PostgREST + Auth)
- **Auth:** Email/password via Supabase Auth. Admin hardcoded: `kim@mammajumboshrimp.com`
- **Deploy:** Build statico su hosting (GitHub Pages / Netlify / etc.) con `npm run build`

### Struttura Database

#### Tabelle principali
| Tabella | Scopo |
|---------|-------|
| `contacts` | Contatti principali (nome, email, social, stato, assegnazione, note) |
| `contact_sources` | Provenienza dati (Wine Awards vs GuildSomm, URL profilo, award, ruolo) |
| `profiles_review_log` | Audit trail — ogni modifica a `status` o `assigned_to` viene loggata |
| `admin_whitelist` | Email con ruolo admin (alternativa al metadata JWT) |

#### Colonne chiave in `contacts`
| Colonna | Tipo | Significato |
|---------|------|-------------|
| `full_name` | text | Nome completo |
| `email` | text | Email (spesso da GuildSomm) |
| `instagram_url` | text | Link Instagram |
| `linkedin_url` | text | Link LinkedIn |
| `status` | enum | **todo** → **reviewed** (workflow operatrice). Dopo claim rimane `todo`. L'operatrice lo porta a `reviewed` con "Pronto a contattare". |
| `review_status` | enum | **seen** / **unseen** — il SK ha già guardato il profilo? |
| `approval` | boolean | Il SK approva il contatto per l'outreach? |
| `contacted` | boolean | Il SK ha già contattato la persona? |
| `assigned_to` | text | Email dell'operatrice che ha fatto claim |
| `claimed_at` | timestamptz | Quando è stato fatto il claim |
| `next_action` | enum | Azione successiva scelta dal **SK** (Da approvare, Follow-up, Contattato, Da verificare, Chiuso). Gli operatori possono solo segnalare "Pronto da contattare". |
| `notes` | text | Note libere dell'operatrice |

### Ruoli
| Ruolo | Come si ottiene | Accesso |
|-------|-----------------|---------|
| **admin** (SK) | Email `kim@mammajumboshrimp.com` OPPURE in `admin_whitelist` | Dashboard SK (`/`) — vede tutto, può togglare approval/contacted/review |
| **operator** | Qualsiasi altro utente registrato | Dashboard Operatore (`/operatore`) — vede solo i propri assegnati |

### Claim System (Atomic & Bloccante)
```
Operatrice clicca "Claim 25" → chiama RPC claim_contacts(25, 'mia@email.com')
```
- Il DB prende **solo** contatti con `assigned_to IS NULL` e `status IN ('todo', 'in_progress')`
- `FOR UPDATE SKIP LOCKED` = impossibile che due operatrici prendano lo stesso contatto
- Dopo il claim, `status` **rimane `todo`** (l'operatrice decide quando è pronta con il bottone "Pronto a contattare")

### Flusso Next Action
| Chi | Cosa fa | Risultato |
|-----|---------|-----------|
| **Operatrice** | Clicca "Pronto a contattare" nel drawer | `next_action = 'pronto_da_contattare'` + `status = 'reviewed'` + **toast success** |
| **Operatrice** | Clicca "Claim questo contatto" nel drawer | Contatto riassegnato a lei (anche se era di un'altra). **Toast success** |
| **SK** | Sceglie Next Action nel drawer | `next_action = da_approvare / follow_up / contattato / da_verificare / chiuso` + **toast success** |
| **SK** | Toggle Review / Approval / Contacted | **Toast success** per ogni azione |
| **SK** | Bulk approval — seleziona righe e clicca "Approva X" | `approval = true` su tutti i selezionati in parallelo. **Toast success** |

### RLS Policies (Sicurezza)
- `contacts_select` — tutti possono leggere tutti i contatti (serve per la dashboard SK)
- `contacts_update` — solo **admin** OPPURE `assigned_to = mia email`
- `contacts_insert` — aperto (serve per l'import script)
- `logs_insert` — aperto (serve per il trigger audit)

### Scripts utili
| Script | Scopo |
|--------|-------|
| `scripts/import-contacts.mjs` | Importa `restaurants.json` + CSV GuildSomm. Merge deterministico su `normalized_name + country + city`. Upsert su Supabase. |
| `scripts/update-emails-from-guildsomm.mjs` | Recovery — aggiorna email mancanti nei contatti esistenti matchando per `profile_url` GuildSomm. |
| `scripts/reset-all-claims.mjs` | Reset completo: `assigned_to = null, claimed_at = null, status = 'todo'` per TUTTI i contatti assegnati. |

### RPC aggiuntivi
| Funzione | Scopo |
|----------|-------|
| `claim_single_contact(contact_id, claim_user)` | Reclama / ruba un singolo contatto specifico (anche se già assegnato). Usato nel drawer operatore con bottone "Claim questo contatto". |
| `mark_social_ready()` | Batch: marca come `pronto_da_contattare` + `reviewed` tutti i contatti che hanno **sia Instagram che LinkedIn** compilati. Restituisce il numero di righe aggiornate. |

### Schema SQL
Tutto il DDL è in `supabase/schema.sql`:
- Tabelle, indici, trigger (`set_updated_at`, `log_contact_changes`)
- RPC `claim_contacts()`, `claim_single_contact()`, `mark_social_ready()`
- Funzione `get_my_role()`
- RLS policies

⚠️ **Ogni modifica allo schema va eseguita nello SQL Editor di Supabase.**

---


## 🤖 PROMPT PER AGENTE AI REVISIONATORE

### Contesto
Sei un QA engineer esperto di UI/UX e React. Devi revisionare l'applicazione **SK DATABASE**, un CRM operativo per il mondo wine, con due viste distinte: **Admin (SK)** e **Operatore**.

### Stack
- React 19 + TypeScript + Vite + Tailwind + shadcn/ui
- Supabase per auth e DB
- Routing con react-router (`/`, `/operatore`, `/login`)

### Task
Revisiona l'app navigando come **entrambi i ruoli** e identifica:

1. **Bug funzionali**
   - Pulsanti che non funzionano
   - Filtri che non applicano correttamente
   - Dati che non si aggiornano dopo un'azione
   - Redirect/login che non funzionano

2. **Problemi di layout / UI**
   - Testo troppo piccolo o troppo grande
   - Elementi troppo attaccati (padding insufficiente)
   - Scroll orizzontale non voluto
   - Colori poco leggibili
   - Drawer/modal che escono fuori dallo schermo

3. **Problemi di UX**
   - Azioni non intuitive (dove clicco? cosa fa questo bottone?)
   - Mancanza di feedback dopo un'azione (toast, loading, errori)
   - Flusso operatore confuso (claim → modifica → salva)
   - SK che vede troppa roba o troppo poca

4. **Problemi di accessibilità / sicurezza**
   - Pagine che dovrebbero essere protette ma sono pubbliche
   - Ruoli che possono fare azioni non consentite
   - Dati sensibili esposti

### Scenari da testare

#### Vista SK (Admin)
1. Login con password-only → redirect a `/`
2. Dashboard: KPI card, tabella contatti, filtri
3. Filtri: IG, LinkedIn, Email, Approvati, Contattati, Seen/Unseen, **Next Action**, **Reset filtri**
4. Click su riga → **auto-mark as Seen** + drawer read-only con card social cliccabili
5. Click su link IG / LinkedIn / Mail in "Azioni" → **auto-mark as Seen** + apre link
6. Toggle Review / Approval / Contacted direttamente in tabella → **toast success**
7. **Bulk approval** — seleziona righe via checkbox, clicca "Approva X" in alto → approva in massa
8. Colonna "Social" mostra badge Completo/Parziale/Mancante
9. Colonna "Assegnato" mostra email operatrice (se claimato)
10. Badge "Note" giallo accanto al nome se ci sono note
11. Sezione "Note operatore" sempre visibile nel drawer (anche se vuota)
12. Next Action select nel drawer → **toast success**
13. Click su KPI card "Ready to Contact" o "Contacted" → applica filtro automaticamente
14. Sign-out → redirect a login

#### Vista Operatore
1. Login email+password → redirect a `/operatore`
2. Dashboard: KPI, tabella, filtri
3. Filtri: **Assegnati a me** / **Non assegnati** / **Assegnati ad altri** / **Reset filtri**
4. Claim X contatti → toast successo → auto-filtro assegnati
5. **Claim singolo** — apri qualsiasi contatto (anche di un'altra) e clicca **"Claim questo contatto"** nel drawer per riassegnartelo
6. Click su riga propria → drawer editabile con campi input (NO Next Action)
7. Click su riga non assegnata → drawer con banner giallo "bloccato"
8. **Colori riga** — verde acqua = tuo, rosa = occupato da altri, bianco = libero. Badge "Tu" / "Occupato" / "Libero" nella prima colonna
9. Modifica campi, Note → Salva → refresh dati
10. Bottone **"Pronto a contattare"** → setta `next_action = pronto_da_contattare` + `status = reviewed` + **toast success**
11. **KPI cliccabili** — "Ready to Contact" e "Contacted" applicano il filtro corrispondente
12. Sign-out

#### Edge Cases
- Operatore prova a modificare contatto non suo → deve essere bloccato (RLS + UI)
- Due operatori fanno claim simultaneo → nessun contatto duplicato
- Admin vede tutto, non può modificare dal drawer (read-only)
- Filtro Email dopo import GuildSomm → trova contatti con email

### Output atteso
Per ogni problema trovato, restituisci:
```
- **Severità**: [Critica / Alta / Media / Bassa]
- **Vista**: [SK / Operatore / Entrambe]
- **Problema**: descrizione chiara
- **Come riprodurre**: passaggi
- **Suggerimento**: come risolvere
```

Alla fine, fornisci un **riepilogo prioritario** con le 3 cose più importanti da sistemare subito.
