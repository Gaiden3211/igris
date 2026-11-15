alter table public.comparison_cache
  add column if not exists source_cards jsonb
  check (source_cards is null or jsonb_typeof(source_cards) = 'array');
