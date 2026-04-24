# SK DATABASE — Agent Guide

This file contains project-specific context for AI coding agents. The reader is assumed to know nothing about the project.

## Project Overview

SK DATABASE is a person-first operational dashboard for unifying and reviewing contacts from two data sources:

1. **Wine Awards** — seed data in `src/data/restaurants.json` (restaurants, wine directors, sommeliers, GMs).
2. **GuildSomm** — scraped profiles imported from CSV.

The runtime UI reads from a Supabase PostgreSQL backend. The dashboard allows operators to filter contacts, claim unassigned batches, advance them through a review workflow (`todo` → `in_progress` → `reviewed`), and edit social/email/employment details. UI labels are in Italian; code and comments are in English.

## Technology Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 7
- **Backend:** Supabase (PostgreSQL + PostgREST). No Supabase client SDK — the app uses a thin `fetch` wrapper (`src/lib/supabase.ts`).
- **Styling:** Tailwind CSS v3.4, CSS variables (shadcn/ui "New York" theme), `tailwindcss-animate`
- **UI Components:** shadcn/ui primitives built on Radix UI (installed in `src/components/ui/`). Icons from `lucide-react`.
- **Forms / Validation:** React Hook Form + Zod + `@hookform/resolvers`
- **Charts:** Recharts (available but not currently used in the main dashboard)
- **Date:** `date-fns`, `react-day-picker`
- **Build Tooling:** Vite with `@vitejs/plugin-react`, `kimi-plugin-inspect-react`
- **Linting:** ESLint 9 (flat config) with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

## Build and Development Commands

All commands run from the project root.

```bash
# Install dependencies
npm install

# Development server (port 3000)
npm run dev

# Type-check and production build
npm run build

# Preview production build locally
npm run preview

# Lint
npm run lint

# Import / merge contacts preview (no DB write)
npm run import:contacts -- --guildsomm /path/to/Scraped_Profiles_Only.csv

# Import / merge contacts and upsert into Supabase (requires service role key)
SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npm run import:contacts -- --guildsomm /path/to/Scraped_Profiles_Only.csv --apply
```

## Environment Variables

Configure environment variables in your deployment platform (e.g., Vercel) or create a local `.env` (git-ignored):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For ingestion scripts only:
- `SUPABASE_SERVICE_ROLE_KEY` — must never be exposed to the browser.

## Project Structure

```
src/
  App.tsx                 # Main dashboard (monolithic, ~600 lines). This IS the app.
  App.css                 # Dashboard-specific layout styles
  main.tsx                # React root renderer
  index.css               # Tailwind directives + CSS variable theme
  components/ui/          # 50+ shadcn/ui components (auto-generated, keep intact)
  data/
    restaurants.json      # Seed dataset for Wine Awards
    restaurants.ts        # Typed import of seed JSON
    socialSnapshot.json   # Legacy / reference data
  hooks/
    use-mobile.ts         # useIsMobile hook
  lib/
    contactsService.ts    # All data operations: fetch, filter, sort, claim, update, KPIs
    supabase.ts           # `sbFetch` wrapper around Supabase REST API
    utils.ts              # `cn(...)` helper for Tailwind class merging
  pages/
    Home.tsx              # Boilerplate Vite page (unused; App.tsx is the entry UI)
  types/
    contact.ts            # Domain types: Contact, ContactSource, filters, sorts, patches
    restaurant.ts         # RestaurantSeed type
scripts/
  import-contacts.mjs     # Node ESM script: CSV parse, deterministic merge, Supabase upsert
supabase/
  schema.sql              # Full DDL: tables, indexes, triggers, RLS policies, RPC function
public/
  restaurants.json        # Static copy of seed data (served at build time)
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled.** `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports` are on.
- **`verbatimModuleSyntax` is enabled.** You must use `import type { ... }` for type-only imports.
- Path alias: `@/` maps to `./src/`. Prefer `@/lib/...`, `@/types/...`, `@/components/ui/...`.
- Prefer explicit return types on exported service functions.

### React
- Functional components only; no class components.
- Hooks follow standard rules (enforced by `eslint-plugin-react-hooks`).
- `react-refresh` is enabled in dev; do not write anonymous default exports for components meant to be fast-refreshed.

### CSS / Tailwind
- Global theme lives in `src/index.css` via CSS variables (`--background`, `--primary`, etc.).
- Tailwind config (`tailwind.config.js`) extends the theme with shadcn color tokens and animation keyframes.
- Component-specific layout styles can go in `App.css`. Avoid adding new global CSS unless necessary.
- Use `cn(...)` from `@/lib/utils` when merging conditional Tailwind classes.

### shadcn/ui Components
- Components in `src/components/ui/` are generated files. Do not hand-edit their API surfaces unless you intend to diverge from shadcn conventions.
- Import pattern: `import { Button } from '@/components/ui/button'`.

## Data Architecture

### Backend
Supabase schema is the source of truth. Key tables:

- `contacts` — unified people records. Unique on `(normalized_name, country, city)`.
- `contact_sources` — provenance rows linking a contact back to Wine Awards or GuildSomm.
- `profiles_review_log` — audit trail of status and assignment changes (populated by trigger).

Key backend features:
- `claim_contacts(claim_count, claim_user)` — RPC function that atomically assigns unassigned `todo`/`in_progress` rows to an operator using `FOR UPDATE SKIP LOCKED`.
- `trg_contacts_audit` — trigger writes to `profiles_review_log` on any `status` or `assigned_to` change.
- `trg_contacts_updated_at` — auto-updates `updated_at`.
- RLS policies: `SELECT` is open; `UPDATE` is restricted to unassigned rows or rows assigned to the current user (falls back to JWT email); `INSERT` is open for ingestion.

### Client Data Flow
- `src/lib/supabase.ts` exposes `sbFetch<T>(path, init?)`. It constructs headers with the anon key and handles JSON parsing.
- `src/lib/contactsService.ts` contains all queries. It fetches all contacts from Supabase, then applies **client-side** filtering and pagination. This is acceptable for the current dataset size but should be revisited if the table grows beyond tens of thousands of rows.
- KPIs are computed client-side by fetching a lightweight column subset and aggregating in `computeDashboardKpi`.

### Import / Merge Logic
`scripts/import-contacts.mjs`:
1. Reads `src/data/restaurants.json` and a GuildSomm CSV.
2. Builds contacts for each dataset.
3. Merges deterministically on `normalized_name + country + city`.
4. Upserts to Supabase with `on_conflict=normalized_name,country,city` for contacts and `on_conflict=source,source_key` for sources.

## Testing

There is **no test framework** installed in this project. If you add tests, prefer:
- **Vitest** (aligns with the Vite toolchain)
- **@testing-library/react** for component tests

Run tests with a command like `npm test` after setup. Update `package.json` scripts accordingly.

## Security Considerations

- Never commit `.env` or `SUPABASE_SERVICE_ROLE_KEY`.
- RLS is enabled on all tables. The frontend anon key can read everything but can only update contacts the user has claimed.
- The import script requires the service role key and should only run from a secure environment.
- The dashboard stores the operator ID in `localStorage` under `skdb_user_id`. This is not authentication; it is a lightweight assignment tag.

## Deployment

The app is a static SPA. `vite.config.ts` sets `base: './'`, so it can be served from any path.

```bash
npm run build
```

Outputs to `dist/`. Serve `dist/` with any static host (e.g., Vercel, Netlify, Cloudflare Pages, Supabase Storage).

## Common Pitfalls

- `src/pages/Home.tsx` is boilerplate and is **not rendered**. The actual UI is entirely inside `src/App.tsx`.
- `react-router` is installed but unused. Do not add routes unless the product requirements change.
- The current client-side filtering/pagination means `fetchContacts` pulls the full `contacts` table. Adding heavy filters (e.g. `source`) performs an additional `contact_sources` lookup and then intersects IDs in memory.
- `verbatimModuleSyntax` means forgetting `type` on a type-only import will fail the build.
- The import script writes a preview file to `tmp/contacts-merged-preview.json`; `tmp/` is gitignored by default via `.gitignore` (if not, add it).
