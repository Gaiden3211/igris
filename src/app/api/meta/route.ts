import {dataRoute} from '@/lib/api';
import {db} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  return dataRoute(async () => {
    const [domains, parameters, scenarios, sources, lastFetch] = await Promise.all([
      db().from('domains').select('id,name,description').eq('enabled', true).order('sort_order'),
      db().from('parameter_definitions').select('id,domain_id,label_en,label_uk,unit,kind').order('sort_order'),
      db().from('scenarios').select('id,domain_id,name_en,name_uk,description_en,description_uk,targets,source_url').order('sort_order'),
      db().from('sources').select('kind,title,url,publisher,license_note,used_for').order('sort_order'),
      db().from('investigations').select('fetched_at').order('fetched_at', {ascending: false}).limit(1),
    ]);
    for (const result of [domains, parameters, scenarios, sources, lastFetch]) if (result.error) throw result.error;
    return {
      domains: domains.data ?? [],
      parameters: parameters.data ?? [],
      scenarios: scenarios.data ?? [],
      sources: sources.data ?? [],
      dataUpdatedAt: lastFetch.data?.[0]?.fetched_at ?? null,
      model: process.env.RADIUM_MODEL ?? 'tycho-1.0',
    };
  });
}
