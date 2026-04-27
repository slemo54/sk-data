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
| `status` | enum | **todo** → **in_progress** → **reviewed** (workflow operatrice) |
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
- Dopo il claim, `status` diventa `in_progress`

### Flusso Next Action
| Chi | Cosa fa | Risultato |
|-----|---------|-----------|
| **Operatrice** | Clicca "Pronto a contattare" nel drawer | `next_action = 'pronto_da_contattare'` + `status = 'reviewed'` |
| **SK** | Sceglie Next Action nel drawer | `next_action = da_approvare / follow_up / contattato / da_verificare / chiuso` |

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

### Schema SQL
Tutto il DDL è in `supabase/schema.sql`:
- Tabelle, indici, trigger (`set_updated_at`, `log_contact_changes`)
- RPC `claim_contacts()`
- Funzione `get_my_role()`
- RLS policies

⚠️ **Ogni modifica allo schema va eseguita nello SQL Editor di Supabase.**

---

## 👑 PER IL CAPO — Guida Molto Semplice

### Come entro
Vai su [link app] → inserisci solo la **password** nella sezione "Accesso SK" → entri.

### Cosa vedo
Una tabella con tutti i contatti. Ogni riga è una persona del mondo wine.

### Cosa devo fare
1. **Guarda i profili** — clicca su una riga per aprire il dettaglio. Si segna automaticamente **Seen** (visto).
2. **Apri i social** — nella colonna "Azioni" ci sono i bottoni IG / LinkedIn / Mail. Clicca e si apre direttamente la pagina. Anche qui si segna automaticamente **Seen**.
3. **Segna manualmente** — se vuoi, clicca sul badge "Unseen" per cambiarlo in "Seen" (o viceversa).
4. **Approva per outreach** — switch "Approval" = sì se la persona è interessante da contattare
5. **Segna se contattato** — icona ✓ = già contattato
6. **Vedi le note** — se un'operatrice ha lasciato note, vedi l'icona 📄 gialla in "Azioni". Passa col mouse sopra per leggere.
7. **Scegli Next Action** — nel drawer c'è il select "Next Action (SK)" per segnare cosa fare con quel contatto: Da approvare, Follow-up, Contattato, Da verificare, Chiuso.

### Colonne importanti
| Colonna | Cosa significa |
|---------|----------------|
| **Nome** | Nome della persona + handle IG/LinkedIn se trovati |
| **Stato Operatore** | `Da fare` / `In corso` / `Revisionato` = a che punto è l'operatrice |
| **Social** | `Completo` = ha IG e LinkedIn. `Parziale` = solo uno. `Mancante` = nessuno. |
| **Review** | `Seen` = tu l'hai già visto. `Unseen` = ancora da guardare. Si aggiorna automaticamente quando clicchi. |
| **Approval** | Sei d'accordo a contattare questa persona? |
| **Contacted** | Hai già mandato mail/messaggio? |
| **Assegnato** | Email dell'operatrice che sta lavorando su questo contatto (se presente). |
| **Azioni** | Bottoni per aprire IG / LinkedIn / Email. Icona 📄 gialla = ci sono note dell'operatrice. |
| **Next Action (SK)** | Nel drawer puoi scegliere: Da approvare, Follow-up, Contattato, Da verificare, Chiuso. **Non** c'è "Pronto da contattare" — quello lo mette l'operatrice. |

### Filtri utili
- **IG / LinkedIn / Email** — mostra solo chi ha quel dato
- **Approvati** — solo quelli che hai già approvato
- **Contattati** — solo quelli che hai già contattato
- **Seen / Unseen** — per sapere cosa ti manca da guardare

### Scorciatoie KPI
- Clicca su **"Ready to Contact"** nella card in alto → filtra automaticamente chi è pronto da contattare.
- Clicca su **"Contacted"** → filtra chi hai già contattato.

---

## 👩‍💻 PER LE OPERATRICI — Guida Completa (Tutti i Casi)

### Come entro
Vai su [link app] → inserisci **email** e **password** nella parte sopra → clicca "Accedi".

### Cosa devo fare
Il tuo compito è **controllare i profili social** delle persone assegnate, trovare Instagram / LinkedIn / Email, e compilare i dati mancanti.

### Passo 1 — Fai Claim
Non puoi modificare nessun contatto senza averlo "claimato" (assegnato a te).

1. Nella barra in basso, trova la scritta **"Claim"**
2. Scrivi quanti contatti vuoi (es. `25`)
3. Clicca **"Vai"**
4. Il sistema ti assegna 25 contatti che nessuna collega sta già lavorando

⚠️ **Se non ci sono contatti disponibili**, significa che sono tutti già assegnati o finiti.

### Passo 2 — Lavora sui tuoi contatti
Dopo il claim, il filtro "Assegnati a me" si attiva automaticamente. Vedi solo i TUOI contatti.

Per ogni contatto:
1. **Clicca sulla riga** → si apre il pannello di modifica
2. Se il pannello ha un **banner giallo con lucchetto** = NON è tuo, non puoi modificarlo
3. Se il pannello ha i campi editabili = è tuo, puoi lavorarci

### Cosa devo compilare
| Campo | Cosa cercare |
|-------|--------------|
| **Instagram** | Cerca la persona su Instagram, copia l'URL del profilo |
| **LinkedIn** | Cerca su LinkedIn, copia l'URL del profilo |
| **Email** | Se trovi email pubblica, inseriscila |
| **Employer** | Ristorante / azienda dove lavora |
| **Title** | Titolo (es. Sommelier, Wine Director) |
| **Occupation** | Ruolo generale |
| **Note** | Scrivi qualsiasi informazione utile |

⚠️ **Non c'è più "Next Action"** — il SK lo gestisce. Tu premi solo **"Pronto a contattare"** quando hai finito.

### Passo 3 — Segnala "Pronto a contattare"
Quando hai finito di cercare info su un contatto e non trovi altro, clicca il bottone **"Pronto a contattare"** nel drawer.

Questo segnala al SK che:
- Hai completato il tuo lavoro su quel contatto
- Il contatto passa in stato `reviewed`
- Il SK lo vedrà come "Pronto da contattare" nella sua dashboard

**Non c'è più "Avanza stato"** — il SK gestisce il Next Action.

### Cosa NON devi fare
| ❌ Non fare | Perché |
|-------------|--------|
| Non fare claim se non hai tempo di lavorarci | Blocchi i contatti alle colleghe |
| Non modificare contatti con banner giallo | Sono di un'altra operatrice |
| Non lasciare campi vuoti se li trovi | Il SK ha bisogno di quei dati |

### Casi speciali

#### Caso A — Il contatto NON ha social
Lascia i campi Instagram / LinkedIn vuoti. Scrivi in "Note": "Nessun social trovato". Avanza lo stato a `reviewed`.

#### Caso B — Trovo solo Instagram (no LinkedIn)
Compila solo Instagram. Lascia LinkedIn vuoto. Scrivi in "Note": "Manca LinkedIn" se vuoi segnalarlo.

#### Caso C — Il SK mi dice di lavorare su un contatto specifico
Chiedi al SK l'ID o il nome. Se il contatto è già assegnato a un'altra operatrice, il SK deve fare lui il re-assign (da admin può modificare tutto).

#### Caso D — Ho sbagliato, voglio "liberare" un contatto
Non puoi farlo da sola. Scrivi al SK: "Contatto X assegnato per errore, puoi resettarlo?". Il SK può togliere l'assegnazione dalla sua dashboard.

#### Caso E — Non vedo più contatti da claim
Significa che:
- Tutti i contatti sono già assegnati a te o alle colleghe, OPPURE
- Tutti i contatti sono già in stato `reviewed`

Se hai finito il tuo lavoro, comunica al SK che sei a posto.

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
3. Filtri: IG, LinkedIn, Email, Approvati, Contattati, Seen/Unseen
4. Click su riga → **auto-mark as Seen** + drawer read-only con card social cliccabili
5. Click su link IG / LinkedIn / Mail in "Azioni" → **auto-mark as Seen** + apre link
6. Toggle Review / Approval / Contacted direttamente in tabella
7. Colonna "Social" mostra badge Completo/Parziale/Mancante
8. Colonna "Assegnato" mostra email operatrice (se claimato)
9. Icona 📄 in "Azioni" appare se ci sono note (tooltip al hover)
10. Click su KPI card "Ready to Contact" o "Contacted" → applica filtro automaticamente
11. Sign-out → redirect a login

#### Vista Operatore
1. Login email+password → redirect a `/operatore`
2. Dashboard: KPI, tabella, filtri
3. Filtro "Assegnati a me" / "Non assegnati"
4. Claim X contatti → toast successo → auto-filtro assegnati
5. Click su riga propria → drawer editabile con campi input (NO Next Action)
6. Click su riga non assegnata → drawer con banner giallo "bloccato"
7. Modifica campi, Note → Salva → refresh dati
8. Bottone **"Pronto a contattare"** → setta `next_action = pronto_da_contattare` + `status = reviewed`
9. Sign-out

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
