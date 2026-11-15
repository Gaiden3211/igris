import type {NextRequest} from 'next/server';
import {dataRoute} from '@/lib/api';
import {loadInvestigations} from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const tally = (values: (string | null)[]) => {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({label, count}));
};

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain');
  return dataRoute(async () => {
    let rows = await loadInvestigations();
    if (domain) rows = rows.filter(r => r.domain_id === domain);
    return {
      total: rows.length,
      withFiles: rows.filter(r => r.file_count > 0).length,
      withTables: rows.filter(r => r.table_count > 0).length,
      publications: rows.reduce((n, r) => n + r.publication_count, 0),
      byYear: tally(rows.map(r => r.start_date?.slice(0, 4) ?? null)).sort((a, b) => a.label.localeCompare(b.label)),
      bySub: tally(rows.map(r => r.sub_research_area)).sort((a, b) => b.count - a.count),
      byHardware: tally(rows.flatMap(r => r.hardware)).sort((a, b) => b.count - a.count),
    };
  });
}
