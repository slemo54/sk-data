# GEMINI.md - SK DATABASE Project Context

## Project Overview
SK DATABASE is a "person-first" dashboard designed to unify and manage contacts from two primary sources:
1.  **Wine Awards:** Extracted from `src/data/restaurants.json`.
2.  **GuildSomm:** Scraped profiles from CSV files.

The application allows operators to claim batches of contacts, review them, and update their social media profiles, emails, and professional details.

### Tech Stack
- **Frontend:** React 19 (TypeScript), Vite 7.
- **Backend:** Supabase (PostgreSQL with PostgREST).
- **Styling:** Vanilla CSS and Tailwind CSS.
- **UI Components:** Radix UI primitives.
- **State Management:** React hooks and local state.
- **Data Validation:** Zod.

## Project Structure
- `src/`: Main source code.
    - `components/ui/`: Reusable UI components based on Radix UI.
    - `data/`: Local data files, including the `restaurants.json` seed.
    - `hooks/`: Custom React hooks (e.g., `use-mobile.ts`).
    - `lib/`: Core services and utilities.
        - `contactsService.ts`: Business logic for fetching, filtering, and updating contacts.
        - `supabase.ts`: Supabase client configuration and fetch wrapper.
        - `utils.ts`: Utility functions (e.g., class merging).
    - `pages/`: Main application pages (currently primarily `App.tsx` acts as the dashboard).
    - `types/`: TypeScript definitions for contacts and restaurants.
- `scripts/`: Operational scripts.
    - `import-contacts.mjs`: Node.js script to merge datasets and ingest them into Supabase.
- `supabase/`: Database configuration.
    - `schema.sql`: PostgreSQL schema, triggers, and RPC functions.
- `public/`: Static assets.

## Building and Running

### Prerequisites
- Node.js (v20+ recommended).
- A Supabase project.

### Commands
- **Install Dependencies:** `npm install`
- **Development Server:** `npm run dev`
- **Build Production:** `npm run build`
- **Linting:** `npm run lint`
- **Data Import:**
    ```bash
    # Preview merge result
    node scripts/import-contacts.mjs --guildsomm path/to/profiles.csv
    
    # Apply to Supabase (requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
    node scripts/import-contacts.mjs --guildsomm path/to/profiles.csv --apply
    ```

## Development Conventions

### Data Merging Logic
Contacts are merged deterministically based on a composite key: `normalized_name + country + city`. The `import-contacts.mjs` script handles this normalization and deduplication.

### Database Auditing
Any change to a contact's `status` or `assigned_to` field is automatically logged in the `profiles_review_log` table via a PostgreSQL trigger (`trg_contacts_audit`).

### Workflow States
Contacts move through a simple linear workflow:
`todo` -> `in_progress` -> `reviewed`

### Operator ID
Operators must set their "Operator ID" (stored in `localStorage`) to claim contacts. Contacts are "claimed" via a stored procedure `claim_contacts` which ensures atomicity and prevents double-claiming.

### Environment Variables
The following variables are required in `.env`:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY`: Required only for ingestion scripts (keep this out of client-side code).

## Key Files
- `src/App.tsx`: Main dashboard implementation.
- `src/lib/contactsService.ts`: Core data fetching and mutation logic.
- `supabase/schema.sql`: Source of truth for database structure.
- `scripts/import-contacts.mjs`: Logic for unifying disparate datasets.
