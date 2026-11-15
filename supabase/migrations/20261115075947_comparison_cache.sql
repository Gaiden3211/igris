create table if not exists public.comparison_cache (
  cache_key text primary key,
  answer text check (length(answer) between 1 and 16000),
  lease_id uuid not null,
  lease_until timestamptz not null
);

alter table public.comparison_cache enable row level security;
revoke all on public.comparison_cache from public, anon, authenticated;
grant select, insert, update on public.comparison_cache to service_role;

create or replace function public.claim_comparison(p_key text, p_lease uuid, p_seconds integer)
returns boolean
language sql
set search_path = ''
as $$
  with claimed as (
    insert into public.comparison_cache as c (cache_key, lease_id, lease_until)
    values (p_key, p_lease, now() + make_interval(secs => p_seconds))
    on conflict (cache_key) do update
      set lease_id = excluded.lease_id, lease_until = excluded.lease_until
      where c.answer is null and c.lease_until <= now()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_comparison(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_comparison(text, uuid, integer) to service_role;
