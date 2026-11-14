import {db} from '../supabase';

export interface SourceCard {
  id: string;          // citation id: accession (PSI-25) or PUB-<n>
  kind: 'investigation' | 'publication';
  title: string;
  subtitle?: string;
  url: string;
  investigationId?: string;
}

export interface Retrieved {
  cards: SourceCard[];
  context: string;     // the SOURCES block handed to the model
}

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

/** Skill: resolve accessions or acronyms the user named to investigation ids. */
async function resolveIds(names: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const raw of names.slice(0, 6)) {
    const name = raw.trim();
    if (!name) continue;
    if (/^PSI-\d+$/i.test(name)) {
      out.add(name.toUpperCase());
      continue;
    }
    const {data} = await db().from('investigations').select('id').ilike('acronym', `%${name.replace(/[%_]/g, '')}%`).limit(3);
    data?.forEach(r => out.add(r.id));
  }
  return [...out];
}

/** Skills: search_investigations + search_passages + get_investigation, merged into one cited context. */
export async function retrieve(queries: string[], namedIds: string[], domain: string | null, broaden = false): Promise<Retrieved> {
  const ids = new Set<string>(await resolveIds(namedIds));
  const passages = new Map<number, {investigation_id: string | null; section: string; content: string; source_url: string}>();

  async function search(searchDomain: string | null) {
    for (const q of queries.slice(0, 3)) {
      const [inv, chunks] = await Promise.all([
        // any_terms: a record matching most of the planner's keywords can still be found.
        db().rpc('search_investigations', {q, domain: searchDomain, lim: 6, any_terms: true}),
        db().rpc('search_chunks', {q, domain: searchDomain, lim: 8, any_terms: true}),
      ]);
      inv.data?.forEach((r: {id: string}) => ids.add(r.id));
      chunks.data?.forEach((c: {id: number; investigation_id: string | null; section: string; content: string; source_url: string}) =>
        passages.set(c.id, c),
      );
    }
    passages.forEach(p => p.investigation_id && ids.add(p.investigation_id));
  }

  await search(domain);
  if (broaden && domain && ids.size === 0) await search(null);

  return buildContext([...ids].slice(0, 8), {maxAbstracts: 6});
}

/**
 * Skill: get_investigation for a fixed list of ids, merged into one cited context.
 * Records keep the order of `idList`. With `perInvestigation`, abstracts are spread evenly so every record gets some.
 */
export async function buildContext(
  idList: string[],
  opts: {maxAbstracts: number; perInvestigation?: number; titlesPerInvestigation?: number},
): Promise<Retrieved> {
  if (idList.length === 0) return {cards: [], context: ''};

  const [{data: invRows}, {data: params}, {data: pubs}] = await Promise.all([
    db().from('investigations')
      .select('id,acronym,title,sub_research_area,project_type,start_date,end_date,objective,hypothesis,approach,impacts,hardware,platform,file_count,table_count,publication_count,source_url')
      .in('id', idList),
    db().from('investigation_parameters')
      .select('investigation_id,parameter_id,value_num,value_min,value_max,value_text,unit,origin')
      .in('investigation_id', idList),
    db().from('publications').select('id,investigation_id,title,authors,year,url,doi,abstract').in('investigation_id', idList).limit(opts.perInvestigation ? 300 : 40),
  ]);

  const cards: SourceCard[] = [];
  const blocks: string[] = [];
  const invs = (invRows ?? []).sort((a, b) => idList.indexOf(a.id) - idList.indexOf(b.id));

  for (const i of invs) {
    cards.push({
      id: i.id,
      kind: 'investigation',
      title: i.acronym ? `${i.acronym}: ${i.title}` : i.title,
      subtitle: i.sub_research_area ?? undefined,
      url: i.source_url,
      investigationId: i.id,
    });
    const p = (params ?? [])
      .filter(x => x.investigation_id === i.id)
      .map(x => {
        const v = x.value_text ?? (x.value_min != null || x.value_max != null ? `${x.value_min ?? '?'}–${x.value_max ?? '?'}` : x.value_num);
        return `${x.parameter_id}=${v}${x.unit ? ' ' + x.unit : ''} (origin=${x.origin})`;
      });
    blocks.push(
      [
        `[${i.id}] ${i.acronym ?? ''} — ${i.title}`,
        `area: ${i.sub_research_area ?? 'n/a'}; type: ${i.project_type ?? 'n/a'}; dates: ${i.start_date ?? '?'} to ${i.end_date ?? '?'}`,
        `hardware: ${(i.hardware ?? []).join(', ') || 'n/a'}; platform: ${i.platform ?? 'n/a'}`,
        `public files: ${i.file_count}; summary tables: ${i.table_count}; publications: ${i.publication_count}`,
        i.objective && `objective: ${clip(i.objective, 700)}`,
        i.hypothesis && `hypothesis: ${clip(i.hypothesis, 400)}`,
        i.approach && `approach: ${clip(i.approach, 600)}`,
        i.impacts && `impacts: ${clip(i.impacts, opts.titlesPerInvestigation ? 700 : 400)}`,
        p.length > 0 && `parameters: ${p.join('; ')}`,
      ].filter(Boolean).join('\n'),
    );
  }

  // Publications with abstracts are the only place results are reported, so they get their own citation ids.
  const withAbstract = (pubs ?? []).filter(p => p.abstract);
  const ranked = opts.perInvestigation
    ? idList.flatMap(id => withAbstract.filter(p => p.investigation_id === id).slice(0, opts.perInvestigation)).slice(0, opts.maxAbstracts)
    : withAbstract.slice(0, opts.maxAbstracts);
  for (const p of ranked) {
    const id = `PUB-${p.id}`;
    cards.push({
      id,
      kind: 'publication',
      title: p.title,
      subtitle: [p.authors && clip(p.authors, 60), p.year].filter(Boolean).join(' · ') || undefined,
      url: p.url ?? (p.doi ? `https://doi.org/${p.doi}` : ''),
      investigationId: p.investigation_id ?? undefined,
    });
    blocks.push(`[${id}] paper for ${p.investigation_id}: ${p.title} (${p.year ?? 'n.d.'})\nabstract: ${clip(p.abstract, 900)}`);
  }

  // Most PSI papers come without an abstract, but their titles often state what the work found or produced
  // ("Microgravity flammability boundary for PMMA rods..."). Newest titles per investigation, marked as title-only.
  if (opts.titlesPerInvestigation) {
    const used = new Set(ranked.map(p => p.id));
    for (const invId of idList) {
      const titles = (pubs ?? [])
        .filter(p => p.investigation_id === invId && !used.has(p.id))
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .slice(0, opts.titlesPerInvestigation);
      if (titles.length === 0) continue;
      for (const p of titles) {
        cards.push({
          id: `PUB-${p.id}`,
          kind: 'publication',
          title: p.title,
          subtitle: [p.authors && clip(p.authors, 60), p.year].filter(Boolean).join(' · ') || undefined,
          url: p.url ?? (p.doi ? `https://doi.org/${p.doi}` : ''),
          investigationId: p.investigation_id ?? undefined,
        });
      }
      blocks.push(
        `paper titles for ${invId} (title only, no abstract):\n` +
          titles.map(p => `[PUB-${p.id}] ${clip(p.title, 220)} (${p.year ?? 'n.d.'})`).join('\n'),
      );
    }
  }

  return {cards, context: blocks.join('\n\n')};
}
