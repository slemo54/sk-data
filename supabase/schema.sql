-- SK DATABASE 2.0 schema
-- Run in Supabase SQL editor (in order).

create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  city text,
  country text,
  email text,
  instagram_url text,
  linkedin_url text,
  employer text,
  title text,
  occupation text,
  cms_cert text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'reviewed')),
  assigned_to text,
  claimed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_name, country, city)
);

create table if not exists public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source text not null check (source in ('wine_awards', 'guildsomm')),
  source_key text not null,
  restaurant_name text,
  award text,
  wine_role text,
  profile_url text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  unique(source, source_key)
);

create table if not exists public.profiles_review_log (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  changed_by text,
  old_status text,
  new_status text,
  old_assigned_to text,
  new_assigned_to text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_normalized_name on public.contacts(normalized_name);
create index if not exists idx_contacts_status on public.contacts(status);
create index if not exists idx_contacts_assigned_to on public.contacts(assigned_to);
create index if not exists idx_contacts_country on public.contacts(country);
create index if not exists idx_contact_sources_contact_id on public.contact_sources(contact_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create or replace function public.log_contact_changes()
returns trigger
language plpgsql
as $$
declare
  actor text;
begin
  actor := coalesce(current_setting('request.jwt.claims', true)::json->>'email', new.assigned_to, 'system');

  if tg_op = 'UPDATE' and (
    old.status is distinct from new.status
    or old.assigned_to is distinct from new.assigned_to
  ) then
    insert into public.profiles_review_log (
      contact_id,
      changed_by,
      old_status,
      new_status,
      old_assigned_to,
      new_assigned_to
    )
    values (
      new.id,
      actor,
      old.status,
      new.status,
      old.assigned_to,
      new.assigned_to
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contacts_audit on public.contacts;
create trigger trg_contacts_audit
after update on public.contacts
for each row execute function public.log_contact_changes();

create or replace function public.claim_contacts(claim_count integer, claim_user text)
returns setof public.contacts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from public.contacts
    where assigned_to is null and status in ('todo', 'in_progress')
    order by created_at asc
    for update skip locked
    limit greatest(claim_count, 0)
  )
  update public.contacts c
  set assigned_to = claim_user,
      claimed_at = now(),
      status = case when c.status = 'todo' then 'in_progress' else c.status end,
      updated_at = now()
  from picked
  where c.id = picked.id
  returning c.*;
end;
$$;

alter table public.contacts enable row level security;
alter table public.contact_sources enable row level security;
alter table public.profiles_review_log enable row level security;

-- Viewer / capo: read access.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
for select
using (true);

drop policy if exists sources_select on public.contact_sources;
create policy sources_select on public.contact_sources
for select
using (true);

drop policy if exists logs_select on public.profiles_review_log;
create policy logs_select on public.profiles_review_log
for select
using (true);

-- Team updates are limited to claimable or assigned rows.
drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
for update
using (
  assigned_to is null
  or assigned_to = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
)
with check (
  assigned_to is null
  or assigned_to = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
);

-- Service role or SQL editor can insert/update through ingestion scripts.
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
for insert
with check (true);

drop policy if exists sources_insert on public.contact_sources;
create policy sources_insert on public.contact_sources
for insert
with check (true);

grant execute on function public.claim_contacts(integer, text) to anon, authenticated;
