import {dataRoute} from '@/lib/api';
import {db} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: {params: Promise<{id: string}>}) {
  const {id} = await ctx.params;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) return Response.json({error: 'bad_request'}, {status: 400});
  return dataRoute(async () => {
    const [inv, params, pubs, files] = await Promise.all([
      db().from('investigations')
        .select('id,domain_id,acronym,title,doi,research_area,sub_research_area,project_type,start_date,end_date,release_date,description,objective,hypothesis,approach,impacts,hardware,platform,file_count,table_count,total_bytes,file_formats,publication_count,contacts,source_url,fetched_at')
        .eq('id', id).maybeSingle(),
      db().from('investigation_parameters').select('parameter_id,value_num,value_min,value_max,value_text,unit,origin,source_url,source_note').eq('investigation_id', id),
      db().from('publications').select('id,source,title,authors,year,doi,url').eq('investigation_id', id).order('year', {ascending: false}).limit(200),
      db().from('files').select('file_name,bytes,category,kind,restricted').eq('investigation_id', id).order('kind', {ascending: false}).order('bytes', {ascending: false}).limit(60),
    ]);
    if (!inv.data) return {investigation: null};
    const related = await db().from('investigations')
      .select('id,acronym,title').eq('sub_research_area', inv.data.sub_research_area ?? '').neq('id', id).limit(6);
    return {investigation: inv.data, parameters: params.data ?? [], publications: pubs.data ?? [], files: files.data ?? [], related: related.data ?? []};
  });
}
