import {sourcesForInvestigation} from './agent/challenge-sources';
import {cleanCatalogLabel, distinctHardware, hardwareKey} from './catalogLabels';
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
  reference_count: number;
  source_url: string;
}

const LIGHT =
  'id,domain_id,acronym,title,sub_research_area,project_type,start_date,end_date,hardware,platform,file_count,table_count,publication_count,source_url';

// The catalogue is a few hundred rows, so it is loaded once per request and filtered in memory.
export async function loadInvestigations(): Promise<InvestigationRow[]> {
  const {data, error} = await db().from('investigations').select(LIGHT).order('id').limit(2000);
  if (error) throw error;
  const rows = (data ?? []) as Omit<InvestigationRow, 'reference_count'>[];
  const canonicalHardware = new Map<string, string>();
  for (const label of distinctHardware(rows.flatMap(row => (row.hardware as string[] | null) ?? []))) {
    canonicalHardware.set(hardwareKey(label), label);
  }
  return rows.map(row => ({
    ...row,
    hardware: distinctHardware((row.hardware as string[] | null) ?? []).map(label => canonicalHardware.get(hardwareKey(label)) ?? label),
    sub_research_area: typeof row.sub_research_area === 'string' ? cleanCatalogLabel(row.sub_research_area) || null : null,
    reference_count: sourcesForInvestigation(String(row.id)).length,
  })) as InvestigationRow[];
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
  const q = query.q?.trim();
  const [allRows, matches, ranked] = await Promise.all([
    loadInvestigations(),
    q ? db().from('investigations').select('id').textSearch('fts', q, {type: 'websearch', config: 'english'})
      .order('id').limit(2000).throwOnError() : null,
    q ? db().rpc('search_investigations', {q, domain: query.domain ?? null, lim: 25}).throwOnError() : null,
  ]);
  let rows = query.domain ? allRows.filter(r => r.domain_id === query.domain) : allRows;
  const rank = new Map<string, number>((ranked?.data ?? []).map((r: {id: string; rank: number}) => [r.id, r.rank]));
  const needle = q?.toLowerCase();
  const exact = (r: InvestigationRow) => Number(r.id.toLowerCase() === needle || r.acronym?.toLowerCase() === needle);
  if (needle) {
    const fullText = new Set((matches?.data ?? []).map(r => r.id));
    rows = rows.filter(r => fullText.has(r.id) || rank.has(r.id) || exact(r)
      || r.acronym?.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle));
  }

  // Each facet counts the rows that match every OTHER filter, so a number always equals the results you get by
  // picking that option (Topic = Colloids no longer shows hardware that no colloid investigation used).
  const bySub = (r: InvestigationRow) => !query.sub || r.sub_research_area === cleanCatalogLabel(query.sub);
  const selectedHardware = query.hardware ? hardwareKey(query.hardware) : '';
  const byHardware = (r: InvestigationRow) => !selectedHardware || r.hardware.some(label => hardwareKey(label) === selectedHardware);
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

  const orders = ['newest', 'oldest', 'files', 'tables', 'publications', 'name', ...(needle ? ['relevance'] : [])];
  const sort = query.sort && orders.includes(query.sort) ? query.sort : needle ? 'relevance' : 'newest';
  const collator = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});
  const dateOrder = (a: InvestigationRow, b: InvestigationRow, direction: number) =>
    Number(!a.start_date) - Number(!b.start_date)
    || (a.start_date ?? '').localeCompare(b.start_date ?? '') * direction;
  const order = (a: InvestigationRow, b: InvestigationRow) => {
    switch (sort) {
      case 'relevance':
        return exact(b) - exact(a) || (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0);
      case 'oldest': return dateOrder(a, b, 1);
      case 'files': return b.file_count - a.file_count;
      case 'tables': return b.table_count - a.table_count;
      case 'publications': return b.publication_count - a.publication_count;
      case 'name': return collator.compare(a.acronym ?? a.title, b.acronym ?? b.title);
      default: return dateOrder(a, b, -1);
    }
  };
  rows.sort((a, b) => order(a, b) || collator.compare(a.id, b.id));

  return {total: rows.length, rows, facets, sort};
}
