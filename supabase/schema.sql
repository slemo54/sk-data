-- SK DATABASE 2.0 schema
-- Run in Supabase SQL editor (in order).

create extension if not exists pgcrypto;

-- Base tables (safe to re-run; ALTER TABLE handles migrations)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  first_name text,
  last_name text,
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

-- Migrate: add outreach columns if missing
alter table public.contacts
  add column if not exists review_status text default 'unseen' check (review_status in ('seen', 'unseen')),
  add column if not exists next_action text,
  add column if not exists approval boolean default false,
  add column if not exists contacted boolean default false,
  add column if not exists notes text,
  add constraint if not exists contacts_next_action_check
    check (next_action is null or next_action in (
      'pronto_da_contattare',
      'da_approvare',
      'follow_up',
      'contattato',
      'da_verificare',
      'chiuso'
    ));

create table if not exists public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source text not null check (source in ('wine_awards', 'guildsomm', 'linkedin_sk', 'via_db')),
  source_key text not null,
  restaurant_name text,
  award text,
  wine_role text,
  profile_url text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  unique(source, source_key)
);

alter table public.contact_sources
  drop constraint if exists contact_sources_source_check,
  add constraint contact_sources_source_check
    check (source in ('wine_awards', 'guildsomm', 'linkedin_sk', 'via_db'));

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

create table if not exists public.admin_whitelist (
  email text primary key
);

create table if not exists public.pending_operators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  auth_user_id uuid,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_contacts_normalized_name on public.contacts(normalized_name);
create index if not exists idx_contacts_status on public.contacts(status);
create index if not exists idx_contacts_assigned_to on public.contacts(assigned_to);
create index if not exists idx_contacts_country on public.contacts(country);
create index if not exists idx_contacts_review_status on public.contacts(review_status);
create index if not exists idx_contacts_next_action on public.contacts(next_action);
create index if not exists idx_contact_sources_contact_id on public.contact_sources(contact_id);
create index if not exists idx_pending_operators_email on public.pending_operators(email);
create index if not exists idx_pending_operators_status on public.pending_operators(status);

-- Auto-populate full_name from first_name + last_name
create or replace function public.set_full_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.first_name is not null or NEW.last_name is not null then
    NEW.full_name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_full_name on public.contacts;
create trigger trg_set_full_name
before insert or update on public.contacts
for each row
execute function public.set_full_name();

-- Updated at trigger
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

drop trigger if exists trg_pending_operators_updated_at on public.pending_operators;
create trigger trg_pending_operators_updated_at
before update on public.pending_operators
for each row execute function public.set_updated_at();

create or replace function public.create_pending_operator_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email <> 'kim@mammajumboshrimp.com' then
    insert into public.pending_operators (email, auth_user_id, status)
    values (new.email, new.id, 'pending')
    on conflict (email) do update
      set auth_user_id = excluded.auth_user_id,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_pending_operator on auth.users;
create trigger trg_auth_user_pending_operator
after insert on auth.users
for each row execute function public.create_pending_operator_for_new_user();

revoke all on function public.create_pending_operator_for_new_user() from public, anon, authenticated;

-- Audit trigger
create or replace function public.log_contact_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  actor := coalesce(current_setting('request.jwt.claims', true)::json->>'email', new.assigned_to, 'system');

  if tg_op = 'UPDATE' and (
    old.status is distinct from new.status
    or old.assigned_to is distinct from new.assigned_to
    or old.approval is distinct from new.approval
    or old.contacted is distinct from new.contacted
    or old.next_action is distinct from new.next_action
    or old.review_status is distinct from new.review_status
  ) then
    insert into public.profiles_review_log (
      contact_id,
      changed_by,
      old_status,
      new_status,
      old_assigned_to,
      new_assigned_to,
      note
    )
    values (
      new.id,
      actor,
      old.status,
      new.status,
      old.assigned_to,
      new.assigned_to,
      jsonb_build_object(
        'old_approval', old.approval,
        'new_approval', new.approval,
        'old_contacted', old.contacted,
        'new_contacted', new.contacted,
        'old_next_action', old.next_action,
        'new_next_action', new.next_action,
        'old_review_status', old.review_status,
        'new_review_status', new.review_status
      )::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contacts_audit on public.contacts;
create trigger trg_contacts_audit
after update on public.contacts
for each row execute function public.log_contact_changes();

-- Claim RPC
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
      status = c.status,
      updated_at = now()
  from picked
  where c.id = picked.id
  returning c.*;
end;
$$;

-- Claim singolo contatto (riassegna anche se già assegnato)
create or replace function public.claim_single_contact(contact_id uuid, claim_user text)
returns setof public.contacts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.contacts
  set assigned_to = claim_user,
      claimed_at = now()
  where id = contact_id
  returning *;
end;
$$;

-- RLS
alter table public.contacts enable row level security;
alter table public.contact_sources enable row level security;
alter table public.profiles_review_log enable row level security;
alter table public.pending_operators enable row level security;

grant select, insert, update on public.pending_operators to authenticated;

-- Role helper
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true)::json->>'email', '') = 'kim@mammajumboshrimp.com'
      then 'admin'
    when exists (
      select 1 from public.admin_whitelist
      where email = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
    ) then 'admin'
    when coalesce(current_setting('request.jwt.claims', true)::json->>'app_metadata', '{}')::json->>'role' = 'admin'
      then 'admin'
    else 'operator'
  end;
$$;

-- Policies
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
for select to authenticated
using (true);

drop policy if exists sources_select on public.contact_sources;
create policy sources_select on public.contact_sources
for select to authenticated
using (true);

drop policy if exists logs_select on public.profiles_review_log;
create policy logs_select on public.profiles_review_log
for select to authenticated
using (true);

drop policy if exists logs_insert on public.profiles_review_log;
create policy logs_insert on public.profiles_review_log
for insert
with check (true);

drop policy if exists pending_operators_insert_self on public.pending_operators;
create policy pending_operators_insert_self on public.pending_operators
for insert to authenticated
with check (
  email = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
);

drop policy if exists pending_operators_select_self_or_admin on public.pending_operators;
create policy pending_operators_select_self_or_admin on public.pending_operators
for select to authenticated
using (
  public.get_my_role() = 'admin'
  or email = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
);

drop policy if exists pending_operators_update_admin on public.pending_operators;
create policy pending_operators_update_admin on public.pending_operators
for update to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
for update
using (
  public.get_my_role() = 'admin'
  or assigned_to = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
)
with check (
  public.get_my_role() = 'admin'
  or assigned_to = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
);

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
for insert
with check (true);

drop policy if exists sources_insert on public.contact_sources;
create policy sources_insert on public.contact_sources
for insert
with check (true);

-- Grants
-- Mark contacts with both Instagram and LinkedIn, or LinkedIn plus a real location, as Ready to Contact
-- Useful one-off or periodic batch operation
create or replace function public.mark_social_ready()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  update public.contacts
  set next_action = 'pronto_da_contattare',
      status = 'reviewed',
      updated_at = now()
  where linkedin_url is not null
    and linkedin_url <> ''
    and (
      (instagram_url is not null and instagram_url <> '')
      or nullif(lower(trim(coalesce(city, ''))), 'no data') is not null
      or nullif(lower(trim(coalesce(country, ''))), 'no data') is not null
    )
    and next_action is distinct from 'pronto_da_contattare';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.claim_contacts(integer, text) to authenticated;
grant execute on function public.claim_single_contact(uuid, text) to authenticated;
grant execute on function public.mark_social_ready() to authenticated;
grant execute on function public.get_my_role() to authenticated;

-- Auto-populate normalized_name from full_name on insert/update
-- Fixes "null value in column normalized_name violates not-null constraint"
create or replace function public.set_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  effective_full_name text;
begin
  effective_full_name := coalesce(NEW.full_name, trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')));
  NEW.normalized_name := lower(trim(coalesce(effective_full_name, '')));
  return NEW;
end;
$$;

drop trigger if exists trg_set_normalized_name on public.contacts;
create trigger trg_set_normalized_name
before insert or update on public.contacts
for each row
execute function public.set_normalized_name();

-- Ensure first_name / last_name exist for existing tables
alter table public.contacts
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Migration: split existing full_name into first_name / last_name
update public.contacts
set first_name = trim(split_part(full_name, ' ', 1)),
    last_name = trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 2))
where first_name is null and full_name is not null;

-- Delete policy: admin or assigned operator only
drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
for delete
using (
  public.get_my_role() = 'admin'
  or assigned_to = coalesce(current_setting('request.jwt.claims', true)::json->>'email', '')
);
