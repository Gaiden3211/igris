-- Reserve relevant excerpts for explicitly selected investigations.
create or replace function public.search_study_chunks(q text, investigation_ids text[], lim int default 12)
returns table (id bigint, investigation_id text, section text, content text, source_url text, rank real)
language sql stable set search_path = public as $$
  select c.id, c.investigation_id, c.section, c.content, c.source_url,
         ts_rank_cd(c.fts, igris_tsquery(q, true), 1) as rank
  from public.chunks c
  where c.investigation_id = any(investigation_ids)
    and c.fts @@ igris_tsquery(q, true)
  order by rank desc, c.id
  limit least(greatest(lim, 1), 30);
$$;
revoke execute on function public.search_study_chunks(text, text[], int) from public, anon, authenticated;
grant execute on function public.search_study_chunks(text, text[], int) to service_role;
