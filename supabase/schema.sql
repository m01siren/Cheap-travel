-- =============================================================================
-- Полная схема Supabase для проекта «дешёвые маршруты»
-- Выполните весь скрипт в Supabase SQL Editor (один раз на проект).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Утилита updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Профили (1:1 с auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when coalesce(new.raw_user_meta_data->>'role', 'user') in ('admin', 'user') then
        coalesce(new.raw_user_meta_data->>'role', 'user')
      else
        'user'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Helper: is current user an admin?
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Маршруты
-- -----------------------------------------------------------------------------
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null default 'Маршрут',
  origin_city text not null,
  destination_city text not null,
  departure_date date,
  return_date date,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'RUB',
  provider text,
  booking_url text,
  description text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_routes_updated_at on public.routes;
create trigger trg_routes_updated_at
before update on public.routes
for each row execute function public.set_updated_at();

create index if not exists idx_routes_search
  on public.routes(origin_city, destination_city, departure_date);
create index if not exists idx_routes_price on public.routes(price);
create index if not exists idx_routes_owner on public.routes(owner_id);
create index if not exists idx_routes_status on public.routes(status);

-- -----------------------------------------------------------------------------
-- Избранное
-- -----------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_route_unique unique (user_id, route_id)
);

create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_favorites_route on public.favorites(route_id);

-- -----------------------------------------------------------------------------
-- История цен (запись только service_role / backend)
-- -----------------------------------------------------------------------------
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  currency text not null,
  captured_at timestamptz not null default now(),
  source text
);

create index if not exists idx_price_history_route_time
  on public.price_history(route_id, captured_at desc);

-- -----------------------------------------------------------------------------
-- История поиска
-- -----------------------------------------------------------------------------
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_city text,
  destination_city text,
  depart_from date,
  depart_to date,
  max_price numeric(10,2) check (max_price is null or max_price >= 0),
  transport text,
  filters jsonb not null default '{}'::jsonb,
  searched_at timestamptz not null default now()
);

create index if not exists idx_search_history_user_time
  on public.search_history(user_id, searched_at desc);

-- -----------------------------------------------------------------------------
-- Голоса (лайк / дизлайк)
-- -----------------------------------------------------------------------------
create table if not exists public.route_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_votes_user_route_unique unique (user_id, route_id)
);

drop trigger if exists trg_route_votes_updated_at on public.route_votes;
create trigger trg_route_votes_updated_at
before update on public.route_votes
for each row execute function public.set_updated_at();

create index if not exists idx_route_votes_route on public.route_votes(route_id);
create index if not exists idx_route_votes_user on public.route_votes(user_id);

-- -----------------------------------------------------------------------------
-- Комментарии к маршрутам
-- -----------------------------------------------------------------------------
create table if not exists public.route_comments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_route_comments_updated_at on public.route_comments;
create trigger trg_route_comments_updated_at
before update on public.route_comments
for each row execute function public.set_updated_at();

create index if not exists idx_route_comments_route_time
  on public.route_comments(route_id, created_at);
create index if not exists idx_route_comments_author
  on public.route_comments(author_id);

-- -----------------------------------------------------------------------------
-- View: агрегат голосов (удобно для UI)
-- -----------------------------------------------------------------------------
create or replace view public.route_vote_stats as
select
  route_id,
  count(*) filter (where vote = 1) as likes_count,
  count(*) filter (where vote = -1) as dislikes_count,
  coalesce(sum(vote), 0)::bigint as score
from public.route_votes
group by route_id;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.favorites enable row level security;
alter table public.price_history enable row level security;
alter table public.search_history enable row level security;
alter table public.route_votes enable row level security;
alter table public.route_comments enable row level security;

-- profiles
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles for delete to authenticated
using (id = auth.uid() or public.is_admin());

-- routes
drop policy if exists "routes_select_published_or_owner" on public.routes;
create policy "routes_select_published_or_owner"
on public.routes for select
using (
  public.is_admin()
  or status = 'published'
  or owner_id = auth.uid()
);

drop policy if exists "routes_insert_own" on public.routes;
create policy "routes_insert_own"
on public.routes for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "routes_update_own" on public.routes;
create policy "routes_update_own"
on public.routes for update to authenticated
using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "routes_delete_own" on public.routes;
create policy "routes_delete_own"
on public.routes for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- favorites
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- price_history
drop policy if exists "price_history_select_all" on public.price_history;
create policy "price_history_select_all"
on public.price_history for select using (true);

drop policy if exists "price_history_insert_service_role" on public.price_history;
create policy "price_history_insert_service_role"
on public.price_history for insert to service_role
with check (true);

drop policy if exists "price_history_update_service_role" on public.price_history;
create policy "price_history_update_service_role"
on public.price_history for update to service_role
using (true) with check (true);

drop policy if exists "price_history_delete_service_role" on public.price_history;
create policy "price_history_delete_service_role"
on public.price_history for delete to service_role
using (true);

-- search_history
drop policy if exists "search_history_select_own" on public.search_history;
create policy "search_history_select_own"
on public.search_history for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "search_history_insert_own" on public.search_history;
create policy "search_history_insert_own"
on public.search_history for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "search_history_delete_own" on public.search_history;
create policy "search_history_delete_own"
on public.search_history for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- route_votes
drop policy if exists "route_votes_select_all" on public.route_votes;
create policy "route_votes_select_all"
on public.route_votes for select using (true);

drop policy if exists "route_votes_insert_own" on public.route_votes;
create policy "route_votes_insert_own"
on public.route_votes for insert to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.routes r
      where r.id = route_votes.route_id
        and r.status = 'published'
        and r.owner_id is distinct from auth.uid()
    )
  )
);

drop policy if exists "route_votes_update_own" on public.route_votes;
create policy "route_votes_update_own"
on public.route_votes for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.routes r
      where r.id = route_votes.route_id
        and r.status = 'published'
        and r.owner_id is distinct from auth.uid()
    )
  )
);

drop policy if exists "route_votes_delete_own" on public.route_votes;
create policy "route_votes_delete_own"
on public.route_votes for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- route_comments
drop policy if exists "route_comments_select_visible" on public.route_comments;
create policy "route_comments_select_visible"
on public.route_comments for select
using (
  public.is_admin()
  or (
    exists (
      select 1 from public.routes r
      where r.id = route_comments.route_id
        and (r.status = 'published' or r.owner_id = auth.uid())
    )
    and is_deleted = false
  )
);

drop policy if exists "route_comments_insert_not_own_route" on public.route_comments;
create policy "route_comments_insert_not_own_route"
on public.route_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.routes r
    where r.id = route_comments.route_id
      and r.status = 'published'
      and (r.owner_id is distinct from auth.uid() or public.is_admin())
  )
);

drop policy if exists "route_comments_update_own" on public.route_comments;
create policy "route_comments_update_own"
on public.route_comments for update to authenticated
using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "route_comments_delete_own" on public.route_comments;
create policy "route_comments_delete_own"
on public.route_comments for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

-- =============================================================================
-- Готово
-- =============================================================================
