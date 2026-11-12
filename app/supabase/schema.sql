-- Houle : base de données Supabase (comptes, spots privés, amis, partages, cartes communes)
-- Mode d'emploi : Supabase > SQL Editor > New query > coller tout ce fichier > Run.
-- Ce script peut être relancé sans danger (il ne supprime rien).

-- =====================================================================
-- Profils : un pseudo par compte
-- =====================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- Spots : visibles uniquement par leur propriétaire
-- =====================================================================
create table if not exists public.spots (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  notes       text not null default '' check (char_length(notes) <= 4000),
  photos      jsonb not null default '[]'::jsonb,
  photo_count int generated always as (jsonb_array_length(photos)) stored,
  link_url    text not null default '' check (char_length(link_url) <= 500),
  rules       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists spots_owner_idx on public.spots (owner);
alter table public.spots enable row level security;

drop policy if exists spots_owner_all on public.spots;
create policy spots_owner_all on public.spots for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- =====================================================================
-- Amis : demande puis acceptation
-- =====================================================================
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- une seule relation par paire de personnes, quel que soit le sens
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;

create or replace function public.friendships_lock() returns trigger
language plpgsql as $$
begin
  if new.requester <> old.requester or new.addressee <> old.addressee then
    raise exception 'Modification interdite';
  end if;
  return new;
end $$;
drop trigger if exists friendships_lock on public.friendships;
create trigger friendships_lock before update on public.friendships
  for each row execute function public.friendships_lock();

-- vrai si "other" est un ami accepté de la personne connectée
create or replace function public.is_friend(other uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other) or (f.requester = other and f.addressee = auth.uid()))
  );
$$;

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
drop policy if exists friendships_accept on public.friendships;
create policy friendships_accept on public.friendships for update to authenticated
  using (addressee = auth.uid() and status = 'pending')
  with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (requester = auth.uid() or addressee = auth.uid());

-- =====================================================================
-- Partages d'un ami à un autre (spot ou session)
-- =====================================================================
create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('spot', 'session')),
  payload    jsonb not null,
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  check (pg_column_size(payload) < 20000)
);
create index if not exists shares_to_idx on public.shares (to_user, created_at desc);
alter table public.shares enable row level security;

drop policy if exists shares_select on public.shares;
create policy shares_select on public.shares for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists shares_insert on public.shares;
create policy shares_insert on public.shares for insert to authenticated
  with check (from_user = auth.uid() and public.is_friend(to_user));
drop policy if exists shares_update on public.shares;
create policy shares_update on public.shares for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());
drop policy if exists shares_delete on public.shares;
create policy shares_delete on public.shares for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- =====================================================================
-- Cartes communes
-- =====================================================================
create table if not exists public.maps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  owner      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  join_code  text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_at timestamptz not null default now()
);
create table if not exists public.map_members (
  map_id     uuid not null references public.maps(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null check (status in ('invited', 'requested', 'member')),
  created_at timestamptz not null default now(),
  primary key (map_id, user_id)
);
create table if not exists public.map_spots (
  id         uuid primary key default gen_random_uuid(),
  map_id     uuid not null references public.maps(id) on delete cascade,
  added_by   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  snapshot   jsonb not null check (pg_column_size(snapshot) < 20000),
  created_at timestamptz not null default now()
);
create index if not exists map_spots_map_idx on public.map_spots (map_id);
alter table public.maps enable row level security;
alter table public.map_members enable row level security;
alter table public.map_spots enable row level security;

create or replace function public.is_map_member(m uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.map_members x where x.map_id = m and x.user_id = auth.uid() and x.status = 'member');
$$;
create or replace function public.is_map_owner(m uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.maps x where x.id = m and x.owner = auth.uid());
$$;

-- le créateur d'une carte en est automatiquement membre
create or replace function public.maps_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.map_members (map_id, user_id, status) values (new.id, new.owner, 'member') on conflict do nothing;
  return new;
end $$;
drop trigger if exists maps_add_owner on public.maps;
create trigger maps_add_owner after insert on public.maps
  for each row execute function public.maps_add_owner();

-- demander à rejoindre une carte avec son code : le propriétaire doit accepter
create or replace function public.request_join(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  select id into m from public.maps where join_code = upper(trim(code));
  if m is null then raise exception 'Code inconnu'; end if;
  insert into public.map_members (map_id, user_id, status) values (m, auth.uid(), 'requested') on conflict do nothing;
  return m;
end $$;

drop policy if exists maps_select on public.maps;
create policy maps_select on public.maps for select to authenticated using (
  owner = auth.uid()
  or exists (select 1 from public.map_members mm where mm.map_id = maps.id and mm.user_id = auth.uid())
);
drop policy if exists maps_insert on public.maps;
create policy maps_insert on public.maps for insert to authenticated with check (owner = auth.uid());
drop policy if exists maps_update on public.maps;
create policy maps_update on public.maps for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists maps_delete on public.maps;
create policy maps_delete on public.maps for delete to authenticated using (owner = auth.uid());

drop policy if exists mm_select on public.map_members;
create policy mm_select on public.map_members for select to authenticated
  using (user_id = auth.uid() or public.is_map_member(map_id) or public.is_map_owner(map_id));
-- un membre invite un de ses amis ; l'invité doit accepter
drop policy if exists mm_invite on public.map_members;
create policy mm_invite on public.map_members for insert to authenticated
  with check (status = 'invited' and public.is_friend(user_id) and (public.is_map_member(map_id) or public.is_map_owner(map_id)));
-- l'invité accepte son invitation
drop policy if exists mm_accept on public.map_members;
create policy mm_accept on public.map_members for update to authenticated
  using (user_id = auth.uid() and status = 'invited')
  with check (user_id = auth.uid() and status = 'member');
-- le propriétaire accepte une demande
drop policy if exists mm_approve on public.map_members;
create policy mm_approve on public.map_members for update to authenticated
  using (public.is_map_owner(map_id) and status = 'requested')
  with check (public.is_map_owner(map_id) and status = 'member');
drop policy if exists mm_delete on public.map_members;
create policy mm_delete on public.map_members for delete to authenticated
  using (user_id = auth.uid() or public.is_map_owner(map_id));

drop policy if exists ms_select on public.map_spots;
create policy ms_select on public.map_spots for select to authenticated using (public.is_map_member(map_id));
drop policy if exists ms_insert on public.map_spots;
create policy ms_insert on public.map_spots for insert to authenticated
  with check (added_by = auth.uid() and public.is_map_member(map_id));
drop policy if exists ms_delete on public.map_spots;
create policy ms_delete on public.map_spots for delete to authenticated
  using (added_by = auth.uid() or public.is_map_owner(map_id));

-- =====================================================================
-- Droits : seuls les comptes connectés utilisent ces fonctions
-- =====================================================================
revoke execute on function public.is_friend(uuid) from public, anon;
revoke execute on function public.is_map_member(uuid) from public, anon;
revoke execute on function public.is_map_owner(uuid) from public, anon;
revoke execute on function public.request_join(text) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.is_map_member(uuid) to authenticated;
grant execute on function public.is_map_owner(uuid) to authenticated;
grant execute on function public.request_join(text) to authenticated;
