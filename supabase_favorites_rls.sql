-- Run this script in Supabase SQL Editor.
-- It enables cloud favorites with owner-only access via RLS.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_route_unique unique (user_id, route_id)
);

create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_favorites_route on public.favorites(route_id);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());
