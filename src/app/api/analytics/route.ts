import type {NextRequest} from 'next/server';
import {dataRoute} from '@/lib/api';
import {loadInvestigations} from '@/lib/catalog';
import {db} from '@/lib/supabase';

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
    const ids = new Set(rows.map(r => r.id));

    const {data: params} = await db().from('investigation_parameters')
      .select('investigation_id,parameter_id,value_num,value_min,value_max,origin')
      .in('parameter_id', ['oxygen_pct', 'pressure_kpa']);
    const mid = (p: {value_num: number | null; value_min: number | null; value_max: number | null}) =>
      p.value_num ?? (p.value_min != null && p.value_max != null ? (p.value_min + p.value_max) / 2 : (p.value_min ?? p.value_max));
    const byInv = new Map<string, {oxygen?: number; pressure?: number}>();
    for (const p of params ?? []) {
      if (!ids.has(p.investigation_id)) continue;
      const v = mid(p);
      if (v == null) continue;
      const e = byInv.get(p.investigation_id) ?? {};
      if (p.parameter_id === 'oxygen_pct') e.oxygen = v;
      else e.pressure = v;
      byInv.set(p.investigation_id, e);
    }
    const label = new Map(rows.map(r => [r.id, r.acronym ?? r.id]));

    return {
      total: rows.length,
      withFiles: rows.filter(r => r.file_count > 0).length,
      withTables: rows.filter(r => r.table_count > 0).length,
      publications: rows.reduce((n, r) => n + r.publication_count, 0),
      byYear: tally(rows.map(r => r.start_date?.slice(0, 4) ?? null)).sort((a, b) => a.label.localeCompare(b.label)),
      bySub: tally(rows.map(r => r.sub_research_area)).sort((a, b) => b.count - a.count),
      byHardware: tally(rows.flatMap(r => r.hardware)).sort((a, b) => b.count - a.count),
      conditions: [...byInv.entries()]
        .filter(([, v]) => v.oxygen != null && v.pressure != null)
        .map(([id, v]) => ({id, label: label.get(id) ?? id, oxygen: v.oxygen!, pressure: v.pressure!})),
    };
  });
}
