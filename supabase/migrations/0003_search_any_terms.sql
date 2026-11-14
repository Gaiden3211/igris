-- Assistant search: match ANY query term and rank by how many match, instead of requiring ALL terms.
-- With ALL terms, a plan query such as "carbon dioxide fire suppression microgravity" found nothing, because no single
-- record contains every word (FLEX writes "CO2, He, and SF6" and "fire suppressants").
-- Words that appear in nearly every record (microgravity, space, ISS...) are dropped first: they only add noise.
-- The Catalog keeps strict matching (any_terms = false), which is what a person typing a search expects.

create or replace function igris_tsquery(q text, any_terms boolean)
returns tsquery language sql immutable set search_path = public as $$
  with cleaned as (
    select trim(regexp_replace(q,
      '\m(micro-?gravity|reduced gravity|low gravity|space|spaceflight|station|iss|nasa|experiments?|investigations?|study|studies|research|data)\M',
      ' ', 'gi')) as t
  ), base as (
    select websearch_to_tsquery('english', case when length(t) > 0 then t else q end) as tq from cleaned
  )
  select case
    when not any_terms or tq::text = '' then tq
    else replace(tq::text, ' & ', ' | ')::tsquery
  end from base;
$$;

drop function if exists search_investigations(text, text, int);
drop function if exists search_chunks(text, text, int);

create function search_investigations(q text, domain text default null, lim int default 8, any_terms boolean default false)
returns table (id text, acronym text, title text, sub_research_area text, objective text, source_url text, rank real)
language sql stable set search_path = public as $$
  select i.id, i.acronym, i.title, i.sub_research_area, i.objective, i.source_url,
         ts_rank_cd(i.fts, igris_tsquery(q, any_terms), 1) as rank
  from investigations i
  where (domain is null or i.domain_id = domain)
    and i.fts @@ igris_tsquery(q, any_terms)
  order by rank desc
  limit least(greatest(lim, 1), 25);
$$;

create function search_chunks(q text, domain text default null, lim int default 10, any_terms boolean default false)
returns table (id bigint, investigation_id text, section text, content text, source_url text, rank real)
language sql stable set search_path = public as $$
  select c.id, c.investigation_id, c.section, c.content, c.source_url,
         ts_rank_cd(c.fts, igris_tsquery(q, any_terms), 1) as rank
  from chunks c
  left join investigations i on i.id = c.investigation_id
  where (domain is null or i.domain_id = domain)
    and c.fts @@ igris_tsquery(q, any_terms)
  order by rank desc
  limit least(greatest(lim, 1), 30);
$$;

revoke execute on function igris_tsquery(text, boolean) from anon, authenticated, public;
revoke execute on function search_investigations(text, text, int, boolean) from anon, authenticated, public;
revoke execute on function search_chunks(text, text, int, boolean) from anon, authenticated, public;
