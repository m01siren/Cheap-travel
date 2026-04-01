-- Rate limit для прокси входа/регистрации (Edge Functions auth-login / auth-register)
-- Идемпотентно: create if not exists, create or replace function.

create table if not exists public.auth_rate_limit_buckets (
  bucket_key text primary key,
  attempt_count int not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.auth_rate_limit_buckets enable row level security;

create or replace function public.try_auth_rate_limit(p_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  max_attempts int := 10;
  window_seconds int := 900;
begin
  select * into r from public.auth_rate_limit_buckets where bucket_key = p_bucket for update;
  if not found then
    insert into public.auth_rate_limit_buckets (bucket_key, attempt_count, window_started_at)
    values (p_bucket, 1, now());
    return jsonb_build_object('allowed', true, 'remaining', max_attempts - 1);
  end if;

  if r.window_started_at < now() - make_interval(secs => window_seconds) then
    update public.auth_rate_limit_buckets
    set attempt_count = 1, window_started_at = now()
    where bucket_key = p_bucket;
    return jsonb_build_object('allowed', true, 'remaining', max_attempts - 1);
  end if;

  if r.attempt_count >= max_attempts then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds',
      greatest(0, ceil(extract(epoch from (r.window_started_at + make_interval(secs => window_seconds) - now())))::int)
    );
  end if;

  update public.auth_rate_limit_buckets
  set attempt_count = r.attempt_count + 1
  where bucket_key = p_bucket;

  return jsonb_build_object('allowed', true, 'remaining', max_attempts - r.attempt_count - 1);
end;
$$;

revoke all on public.auth_rate_limit_buckets from public;
grant select, insert, update, delete on public.auth_rate_limit_buckets to service_role;

revoke execute on function public.try_auth_rate_limit(text) from public;
grant execute on function public.try_auth_rate_limit(text) to service_role;
