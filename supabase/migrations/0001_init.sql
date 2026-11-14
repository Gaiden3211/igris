-- Igris schema. Domain-agnostic: research areas, their parameters and scenarios are data, not code.
create extension if not exists pg_trgm;

create table domains (
  id text primary key,                 -- slug, e.g. 'combustion-science'
  name text not null,
  description text,
  enabled boolean not null default true,
  sort_order int not null default 100
);

create table investigations (
  id text primary key,                 -- source accession, e.g. 'PSI-25'
  source text not null default 'psi',
  domain_id text references domains(id),
  acronym text,
  title text not null,
  doi text,
  research_area text,
  sub_research_area text,
  project_type text,
  start_date date,
  end_date date,
  release_date date,
  description text,
  objective text,
  hypothesis text,
  approach text,
  impacts text,
  hardware text[] not null default '{}',
  platform text,
  file_count int not null default 0,
  table_count int not null default 0,
  total_bytes bigint,
  file_formats jsonb not null default '{}',
  publication_count int not null default 0,
  contacts jsonb not null default '[]',
  source_url text not null,
  raw jsonb,
  fetched_at timestamptz not null default now(),
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(acronym,'') || ' ' || coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(sub_research_area,'') || ' ' || coalesce(objective,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(description,'') || ' ' || coalesce(hypothesis,'') || ' ' ||
      coalesce(approach,'') || ' ' || coalesce(impacts,'')), 'C')
  ) stored
);
create index investigations_fts on investigations using gin (fts);
create index investigations_domain on investigations (domain_id);
create index investigations_title_trgm on investigations using gin (title gin_trgm_ops);

-- Parameters are defined per domain, so a new research area needs rows, not migrations.
create table parameter_definitions (
  id text primary key,                 -- e.g. 'oxygen_pct'
  domain_id text references domains(id),
  label_en text not null,
  label_uk text not null,
  unit text,
  kind text not null check (kind in ('number','range','category','text')),
  filterable boolean not null default true,
  sort_order int not null default 100
);

create table investigation_parameters (
  id bigint generated always as identity primary key,
  investigation_id text not null references investigations(id) on delete cascade,
  parameter_id text not null references parameter_definitions(id),
  value_num double precision,
  value_min double precision,
  value_max double precision,
  value_text text,
  unit text,                           -- original unit as published
  origin text not null default 'source' check (origin in ('source','ai_extracted','curated')),
  source_url text,
  source_note text
);
create index investigation_parameters_inv on investigation_parameters (investigation_id);
create index investigation_parameters_param on investigation_parameters (parameter_id);

create table publications (
  id bigint generated always as identity primary key,
  investigation_id text references investigations(id) on delete cascade,
  source text not null check (source in ('psi','ntrs')),
  external_id text,
  title text not null,
  authors text,
  year int,
  doi text,
  url text,
  abstract text,
  unique (investigation_id, source, title)
);
create index publications_inv on publications (investigation_id);

create table files (
  id bigint generated always as identity primary key,
  investigation_id text not null references investigations(id) on delete cascade,
  file_name text not null,
  bytes bigint,
  category text,
  kind text not null check (kind in ('archive','experimental_table')),
  restricted boolean not null default false,
  unique (investigation_id, kind, file_name)
);
create index files_inv on files (investigation_id);

-- Searchable text passages the assistant is allowed to quote from.
create table chunks (
  id bigint generated always as identity primary key,
  investigation_id text references investigations(id) on delete cascade,
  publication_id bigint references publications(id) on delete cascade,
  section text not null,               -- objective | approach | abstract | ...
  content text not null,
  source_url text not null,
  fts tsvector generated always as (to_tsvector('english', content)) stored
);
create index chunks_fts on chunks using gin (fts);
create index chunks_inv on chunks (investigation_id);

create table scenarios (
  id text primary key,
  domain_id text references domains(id),
  name_en text not null,
  name_uk text not null,
  description_en text,
  description_uk text,
  targets jsonb not null default '{}', -- {parameter_id: {min,max}} used for ranking and chart overlays
  source_url text,
  sort_order int not null default 100
);

create table sources (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('data','reference','image','software','ai')),
  title text not null,
  url text not null unique,
  publisher text,
  license_note text,
  used_for text,
  sort_order int not null default 100
);

create table visitors (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table chats (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chats_visitor on chats (visitor_id, updated_at desc);

create table messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]',
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index messages_chat on messages (chat_id, id);

create table usage_events (
  id bigint generated always as identity primary key,
  visitor_id uuid,
  ip_hash text,
  kind text not null default 'chat',
  model text,
  key_slot text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  created_at timestamptz not null default now()
);
create index usage_visitor_time on usage_events (visitor_id, created_at desc);
create index usage_ip_time on usage_events (ip_hash, created_at desc);
create index usage_time on usage_events (created_at desc);

-- Row Level Security: everything is locked. The Next.js server is the only client and
-- uses the secret key (which bypasses RLS). The publishable key can read nothing.
alter table domains enable row level security;
alter table investigations enable row level security;
alter table parameter_definitions enable row level security;
alter table investigation_parameters enable row level security;
alter table publications enable row level security;
alter table files enable row level security;
alter table chunks enable row level security;
alter table scenarios enable row level security;
alter table sources enable row level security;
alter table visitors enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table usage_events enable row level security;

-- Ranked full-text search over investigations.
create or replace function search_investigations(q text, domain text default null, lim int default 8)
returns table (id text, acronym text, title text, sub_research_area text, objective text, source_url text, rank real)
language sql stable set search_path = public as $$
  select i.id, i.acronym, i.title, i.sub_research_area, i.objective, i.source_url,
         ts_rank(i.fts, websearch_to_tsquery('english', q)) as rank
  from investigations i
  where (domain is null or i.domain_id = domain)
    and i.fts @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit least(greatest(lim, 1), 25);
$$;

create or replace function search_chunks(q text, domain text default null, lim int default 10)
returns table (id bigint, investigation_id text, section text, content text, source_url text, rank real)
language sql stable set search_path = public as $$
  select c.id, c.investigation_id, c.section, c.content, c.source_url,
         ts_rank(c.fts, websearch_to_tsquery('english', q)) as rank
  from chunks c
  left join investigations i on i.id = c.investigation_id
  where (domain is null or i.domain_id = domain)
    and c.fts @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit least(greatest(lim, 1), 30);
$$;

revoke execute on function search_investigations(text, text, int) from anon, authenticated, public;
revoke execute on function search_chunks(text, text, int) from anon, authenticated, public;
