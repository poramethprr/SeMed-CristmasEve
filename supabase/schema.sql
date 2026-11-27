-- =====================================================================
-- Christmas Event - Supabase schema
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- Internal event app: public read/write via anon key (no auth).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------------------------------------------------

create table if not exists public.users (
  id                 uuid primary key,              -- generated client-side (localStorage)
  display_name       text not null check (char_length(display_name) between 1 and 30),
  last_watered_at    timestamptz,
  last_fertilized_at timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists public.trees (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('community','personal')),
  owner_id         uuid references public.users(id) on delete cascade,
  water_count      int  not null default 0 check (water_count >= 0),
  fertilizer_count int  not null default 0 check (fertilizer_count >= 0),
  votes_count      int  not null default 0 check (votes_count >= 0),
  created_at       timestamptz not null default now(),
  -- community tree has no owner; personal trees must have one
  constraint trees_owner_matches_type check (
    (type = 'community' and owner_id is null) or
    (type = 'personal'  and owner_id is not null)
  )
);
-- exactly one community tree; one personal tree per user
create unique index if not exists trees_single_community
  on public.trees (type) where type = 'community';
create unique index if not exists trees_one_personal_per_owner
  on public.trees (owner_id) where type = 'personal';

create table if not exists public.decorations (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references public.trees(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  item_type    text not null check (item_type in ('bauble','candy_cane','star','gift','bell')),
  color        text not null default '#ff3b3b',
  pos_x        double precision not null,
  pos_y        double precision not null,
  pos_z        double precision not null,
  cheers_count int not null default 0 check (cheers_count >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists decorations_tree_idx on public.decorations (tree_id);

create table if not exists public.tree_votes (
  tree_id    uuid not null references public.trees(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create table if not exists public.wishes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  message        text not null check (char_length(message) between 1 and 280),
  stocking_color text not null default '#d62828',
  cheers_count   int  not null default 0 check (cheers_count >= 0),
  created_at     timestamptz not null default now()
);
create index if not exists wishes_created_idx on public.wishes (created_at desc);

-- ---------- Seed: the single community tree ---------------------------

insert into public.trees (type)
select 'community'
where not exists (select 1 from public.trees where type = 'community');

-- ---------- Triggers --------------------------------------------------

-- Keep trees.votes_count in sync with tree_votes.
create or replace function public.sync_tree_votes() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.trees set votes_count = votes_count + 1 where id = new.tree_id;
  elsif tg_op = 'DELETE' then
    update public.trees set votes_count = greatest(votes_count - 1, 0) where id = old.tree_id;
  end if;
  return null;
end $$;

drop trigger if exists tree_votes_sync on public.tree_votes;
create trigger tree_votes_sync
  after insert or delete on public.tree_votes
  for each row execute function public.sync_tree_votes();

-- A user may not vote for their own personal tree.
create or replace function public.block_self_vote() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.trees t where t.id = new.tree_id and t.owner_id = new.user_id) then
    raise exception 'ไม่สามารถโหวตต้นไม้ของตัวเองได้';
  end if;
  return new;
end $$;

drop trigger if exists tree_votes_no_self on public.tree_votes;
create trigger tree_votes_no_self
  before insert on public.tree_votes
  for each row execute function public.block_self_vote();

-- ---------- RPC: atomic counters (no read-modify-write races) ---------
-- Event window is enforced server-side too: Dec 1 2026 00:00 (+07:00) onward,
-- and it stays open on/after Christmas Day (no upper bound).

-- p_dev: set by the app's password-gated Dev mode so testers can simulate dates.
-- (RLS is open anyway, so this window check is a convenience, not security.)
drop function if exists public.care_for_tree(uuid, uuid, text);
create or replace function public.care_for_tree(
  p_tree_id uuid, p_user_id uuid, p_kind text,   -- 'water' | 'fertilize'
  p_dev boolean default false
) returns public.trees
language plpgsql security definer set search_path = public as $$
declare t public.trees;
begin
  if not p_dev and now() < timestamptz '2026-12-01 00:00:00+07' then
    raise exception 'เริ่มรดน้ำได้วันที่ 1 ธ.ค. 2569';
  end if;
  if p_kind = 'water' then
    update public.trees set water_count = water_count + 1 where id = p_tree_id returning * into t;
    update public.users set last_watered_at = now() where id = p_user_id;
  elsif p_kind = 'fertilize' then
    update public.trees set fertilizer_count = fertilizer_count + 1 where id = p_tree_id returning * into t;
    update public.users set last_fertilized_at = now() where id = p_user_id;
  else
    raise exception 'invalid kind: %', p_kind;
  end if;
  return t;
end $$;

create or replace function public.cheer_decoration(p_id uuid) returns int
language sql security definer set search_path = public as $$
  update public.decorations set cheers_count = cheers_count + 1
  where id = p_id returning cheers_count;
$$;

create or replace function public.cheer_wish(p_id uuid) returns int
language sql security definer set search_path = public as $$
  update public.wishes set cheers_count = cheers_count + 1
  where id = p_id returning cheers_count;
$$;

-- Get-or-create the caller's personal tree.
create or replace function public.ensure_personal_tree(p_user_id uuid) returns public.trees
language plpgsql security definer set search_path = public as $$
declare t public.trees;
begin
  select * into t from public.trees where type = 'personal' and owner_id = p_user_id;
  if not found then
    insert into public.trees (type, owner_id) values ('personal', p_user_id) returning * into t;
  end if;
  return t;
end $$;

grant execute on function
  public.care_for_tree(uuid, uuid, text, boolean),
  public.cheer_decoration(uuid),
  public.cheer_wish(uuid),
  public.ensure_personal_tree(uuid)
to anon, authenticated;

-- ---------- Table privileges for the Data API -------------------------
-- Newer Supabase projects do not auto-grant new tables to anon/authenticated,
-- which causes "permission denied for table ...". RLS below still applies.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.users, public.trees, public.decorations, public.tree_votes, public.wishes
to anon, authenticated;

-- ---------- Row Level Security: public read/write ---------------------
-- Deliberately permissive: internal event app, no login.

do $$
declare tbl text;
begin
  foreach tbl in array array['users','trees','decorations','tree_votes','wishes'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "public read"   on public.%I', tbl);
    execute format('drop policy if exists "public insert" on public.%I', tbl);
    execute format('drop policy if exists "public update" on public.%I', tbl);
    execute format('drop policy if exists "public delete" on public.%I', tbl);
    execute format('create policy "public read"   on public.%I for select using (true)', tbl);
    execute format('create policy "public insert" on public.%I for insert with check (true)', tbl);
    execute format('create policy "public update" on public.%I for update using (true) with check (true)', tbl);
    execute format('create policy "public delete" on public.%I for delete using (true)', tbl);
  end loop;
end $$;

-- ---------- Realtime --------------------------------------------------

do $$
declare tbl text;
begin
  foreach tbl in array array['users','trees','decorations','tree_votes','wishes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

-- Needed so DELETE events carry the full row (e.g. removed ornaments).
alter table public.decorations replica identity full;
alter table public.tree_votes  replica identity full;
