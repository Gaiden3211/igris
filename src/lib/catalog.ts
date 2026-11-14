import {db} from './supabase';

export interface InvestigationRow extends Record<string, unknown> {
  id: string;
  domain_id: string | null;
  acronym: string | null;
  title: string;
  sub_research_area: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  hardware: string[];
  platform: string | null;
  file_count: number;
  table_count: number;
  publication_count: number;
  source_url: string;
}

const LIGHT =
  'id,domain_id,acronym,title,sub_research_area,project_type,start_date,end_date,hardware,platform,file_count,table_count,publication_count,source_url';

// The catalogue is a few hundred rows, so it is loaded once per request and filtered in memory.
export async function loadInvestigations(): Promise<InvestigationRow[]> {
  const {data, error} = await db().from('investigations').select(LIGHT).order('id').limit(2000);
  if (error) throw error;
  return (data ?? []) as InvestigationRow[];
}

export interface CatalogQuery {
  q?: string;
  domain?: string;
  sub?: string;
  hardware?: string;
  data?: string; // 'files' | 'tables' | 'none'
  sort?: string; // relevance | newest | oldest | files | publications
}

const facet = (rows: InvestigationRow[], pick: (r: InvestigationRow) => string[] | string | null) => {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = pick(r);
    for (const key of Array.isArray(v) ? v : v ? [v] : []) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({value, count}));
};

export async function queryCatalog(query: CatalogQuery) {
  let rows = await loadInvestigations();
  if (query.domain) rows = rows.filter(r => r.domain_id === query.domain);

  let rank: Map<string, number> | null = null;
  const q = query.q?.trim();
  if (q) {
    const {data} = await db().rpc('search_investigations', {q, domain: query.domain ?? null, lim: 25});
    rank = new Map((data ?? []).map((r: {id: string; rank: number}) => [r.id, r.rank]));
    const needle = q.toLowerCase();
    // Full-text hits first, plus plain substring matches on id / acronym / title for short or partial terms.
    rows = rows.filter(
      r => rank!.has(r.id) || r.id.toLowerCase() === needle || r.acronym?.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle),
    );
  }

  // Each facet counts the rows that match every OTHER filter, so a number always equals the results you get by
  // picking that option (Topic = Colloids no longer shows hardware that no colloid investigation used).
  const bySub = (r: InvestigationRow) => !query.sub || r.sub_research_area === query.sub;
  const byHardware = (r: InvestigationRow) => !query.hardware || r.hardware.includes(query.hardware);
  const byData = (r: InvestigationRow) =>
    query.data === 'files' ? r.file_count > 0
    : query.data === 'tables' ? r.table_count > 0
    : query.data === 'none' ? r.file_count === 0 && r.table_count === 0
    : true;
  const except = (skip: (r: InvestigationRow) => boolean) =>
    rows.filter(r => [bySub, byHardware, byData].every(f => f === skip || f(r)));

  const forData = except(byData);
  const facets = {
    sub: facet(except(bySub), r => r.sub_research_area),
    hardware: facet(except(byHardware), r => r.hardware),
    data: [
      {value: 'files', count: forData.filter(r => r.file_count > 0).length},
      {value: 'tables', count: forData.filter(r => r.table_count > 0).length},
      {value: 'none', count: forData.filter(r => r.file_count === 0 && r.table_count === 0).length},
    ],
  };

  rows = rows.filter(r => bySub(r) && byHardware(r) && byData(r));

  const sort = query.sort ?? (rank ? 'relevance' : 'newest');
  const date = (r: InvestigationRow) => r.start_date ?? '';
  rows.sort((a, b) => {
    switch (sort) {
      case 'relevance':
        return (rank?.get(b.id) ?? 0) - (rank?.get(a.id) ?? 0);
      case 'oldest':
        return date(a).localeCompare(date(b));
      case 'files':
        return b.file_count - a.file_count;
      case 'publications':
        return b.publication_count - a.publication_count;
      default:
        return date(b).localeCompare(date(a));
    }
  });

  return {total: rows.length, rows, facets, sort};
}
