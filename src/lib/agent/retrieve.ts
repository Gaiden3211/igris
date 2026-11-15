import {distinctHardware} from '../catalogLabels';
import {db} from '../supabase';
import {safeSourceUrl, type SourceCardData as SourceCard} from '../citations';
import sourceContent from './reference-content.json';
import {challengeSources, challengeSourcesReviewedOn, challengeSourceLink, findChallengeSources} from './challenge-sources';
import {associationsForSource} from './source-links';
import {parseFileExcerpt} from './file-evidence';
import {fuseResults, prioritizeStudyFiles} from './rank';
import {studyNames} from './plan';

export interface Retrieved {
  publicEvidence?: boolean;
  publicAbstracts?: {id: string; title: string; text: string}[];
  comparisonScopes?: {id: string; title: string; excerpt: string}[];
  cards: SourceCard[];
  unresolved?: string[];
  context: string;     // cited evidence handed to the model
}

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

const PSI = /^PSI-\d{1,6}$/i;

type Hit = {id: string};

async function resolveIds(names: string[]) {
  const unique = studyNames(names).filter(name => !/^(PUB|DATA|NTRS|REF|FILE)-\d+$/.test(name));
  const resolved = await Promise.all(unique.map(async name => {
    if (PSI.test(name)) {
      const {data} = await db().from('investigations').select('id').eq('id', name).maybeSingle().throwOnError();
      return data ? [data.id as string] : [];
    }
    const {data} = await db().from('investigations').select('id').ilike('acronym', name).order('id').limit(4).throwOnError();
    return (data ?? []).map(r => r.id as string);
  }));
  return {ids: [...new Set(resolved.flat())], unresolved: unique.filter((_, i) => !resolved[i].length)};
}

export async function retrieve(queries: string[], namedIds: string[], domain: string | null, options: {broaden?: boolean; namedOnly?: boolean; withFiles?: boolean} = {}): Promise<Retrieved> {
  const searchQueries = [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, 3);

  async function search(searchDomain: string | null) {
    const results = await Promise.all(searchQueries.map(async q => {
      const lookup = (any_terms: boolean) => Promise.all([
        db().rpc('search_investigations', {q, domain: searchDomain, lim: 8, any_terms}).throwOnError(),
        db().rpc('search_chunks', {q, domain: searchDomain, lim: 12, any_terms}).throwOnError(),
      ]);
      let [inv, chunks] = await lookup(false);
      if (!inv.data?.length && !chunks.data?.length) [inv, chunks] = await lookup(true);
      const passages = (chunks.data as {id: number; investigation_id: string | null; section: string; source_url: string}[] | null) ?? [];
      return {
        lists: [
          ((inv.data as Hit[] | null) ?? []),
          passages.flatMap(p => p.investigation_id ? [{id: p.investigation_id}] : []),
        ],
        abstracts: passages.filter(p => p.section === 'abstract').map(p => p.source_url),
        filePassages: passages.filter(p => p.section.startsWith('file:')).map(p => p.id),
      };
    }));
    return {
      hits: fuseResults(results.flatMap(r => r.lists), r => r.id, 8),
      abstracts: fuseResults(results.map(r => r.abstracts), url => url, 36),
      filePassages: fuseResults(results.map(r => r.filePassages), id => String(id), 16),
    };
  }

  const [{ids: named, unresolved}, first] = await Promise.all([resolveIds(namedIds),
    options.namedOnly ? Promise.resolve({hits: [], abstracts: [], filePassages: []}) : search(domain),
  ]);
  const found = !options.namedOnly && options.broaden && domain && !first.hits.length ? await search(null) : first;
  // Exact references take precedence over search hits.
  const ids = [...new Set([...named, ...(options.namedOnly ? [] : found.hits.map(r => r.id))])].slice(0, Math.max(4, Math.min(named.length, 8)));
  // Reserve passage search for the selected studies; global hits can otherwise crowd out their files.
  const scoped = named.length ? await Promise.all(searchQueries.map(q => db().rpc('search_study_chunks', {
    q, investigation_ids: named, lim: 12,
  }).throwOnError())) : [];
  const scopedPassages = scoped.flatMap(result => result.data ?? []) as {id: number; section: string; source_url: string}[];
  const result = await buildContext(ids, {
    maxAbstracts: 8, perInvestigation: 2, titlesPerInvestigation: 2,
    withFiles: options.withFiles,
    preferredUrls: [...scopedPassages.filter(p => p.section === 'abstract').map(p => p.source_url), ...found.abstracts],
    preferredFilePassages: [...scopedPassages.filter(p => p.section.startsWith('file:')).map(p => p.id), ...found.filePassages], namedCount: Math.min(named.length, 8),
    referenceQueries: searchQueries, referenceNames: namedIds,
  });
  return {...result, unresolved};
}

/** Re-read authoritative sources from the previous answer without running a new text search. */
export async function getSourceContext(sourceIds: string[]): Promise<Retrieved> {
  const numericIds = (prefix: string) => sourceIds.filter(id => id.startsWith(prefix + '-')).map(id => Number(id.slice(prefix.length + 1)));
  const pubIds = numericIds('PUB');
  const fileIds = numericIds('FILE');
  const [papers, files] = await Promise.all([
    pubIds.length ? db().from('publications').select('investigation_id,url').in('id', pubIds).throwOnError() : Promise.resolve({data: []}),
    fileIds.length ? db().from('chunks').select('investigation_id').like('section', 'file:%').in('id', fileIds).throwOnError() : Promise.resolve({data: []}),
  ]);
  const ids = [...new Set([...sourceIds.filter(id => PSI.test(id)),
    ...(papers.data ?? []).map(p => p.investigation_id), ...(files.data ?? []).map(p => p.investigation_id),
  ].filter((id): id is string => Boolean(id)))].slice(0, 8);
  return buildContext(ids, {
    maxAbstracts: 8, perInvestigation: 2, titlesPerInvestigation: 2,
    preferredUrls: (papers.data ?? []).flatMap(p => p.url ? [p.url] : []),
    preferredFilePassages: fileIds, referenceIds: sourceIds,
    withFiles: fileIds.length > 0,
  });
}

/**
 * Skill: get_investigation for a fixed list of ids, merged into one cited context.
 * Records keep the order of `idList`. With `perInvestigation`, abstracts are spread evenly so every record gets some.
 */
export async function buildContext(
  idList: string[],
  opts: {
    maxAbstracts: number;
    perInvestigation?: number;
    titlesPerInvestigation?: number;
    preferredUrls?: string[];
    preferredFilePassages?: number[];
    namedCount?: number;
    referenceQueries?: string[];
    referenceNames?: string[];
    referenceIds?: string[];
    withFiles?: boolean;
    includeComparisonScopes?: boolean;
  },
): Promise<Retrieved> {
  if (idList.length === 0) {
    return addChallengeReferences({cards: [], context: ''}, opts.referenceQueries ?? [], opts.referenceNames ?? [], opts.referenceIds);
  }

  const preferred = new Map(opts.preferredUrls?.map((url, index) => [url, index]));
  const [{data: invRows}, {data: params}, groups, rankedPubs, fileGroups, rankedFiles] = await Promise.all([
    db().from('investigations')
      .select('id,acronym,title,sub_research_area,project_type,start_date,end_date,objective,hypothesis,approach,impacts,hardware,platform,file_count,table_count,publication_count,description,source_url')
      .in('id', idList).throwOnError(),
    db().from('investigation_parameters')
      .select('investigation_id,parameter_id,value_num,value_min,value_max,value_text,unit,origin,source_url')
      .in('investigation_id', idList).order('id').throwOnError(),
    Promise.all(idList.map(async id => {
      const papers = () => db().from('publications').select('id,investigation_id,source,title,authors,year,url,doi,abstract')
        .eq('investigation_id', id).order('year', {ascending: false, nullsFirst: false}).order('id');
      const [abstracts, titles] = await Promise.all([
        papers().not('abstract', 'is', null).neq('abstract', '').limit(8).throwOnError(),
        papers().limit((opts.titlesPerInvestigation ?? 0) + (opts.perInvestigation ?? 2) + 2).throwOnError(),
      ]);
      return [...(abstracts.data ?? []), ...(titles.data ?? [])];
    })),
    preferred.size ? db().from('publications').select('id,investigation_id,source,title,authors,year,url,doi,abstract')
      .in('investigation_id', idList).in('url', [...preferred.keys()]).not('abstract', 'is', null).order('id').limit(100).throwOnError()
      : Promise.resolve({data: []}),
    opts.withFiles === false ? [] : Promise.all(idList.map(id => db().from('chunks').select('id,investigation_id,content,source_url')
      .eq('investigation_id', id).like('section', 'file:%').order('id').limit(2).throwOnError())),
    opts.withFiles !== false && opts.preferredFilePassages?.length ? db().from('chunks').select('id,investigation_id,content,source_url')
      .in('investigation_id', idList).like('section', 'file:%').in('id', opts.preferredFilePassages).limit(16).throwOnError()
      : Promise.resolve({data: []}),
  ]);

  const pubs = [...new Map([...(rankedPubs.data ?? []), ...groups.flat()].map(p => [p.id, p])).values()];
  const cards: SourceCard[] = [];
  const blocks: string[] = [];
  const invs = (invRows ?? []).sort((a, b) => idList.indexOf(a.id) - idList.indexOf(b.id));

  const comparisonScopes = opts.includeComparisonScopes ? invs.map(study => ({
    id: study.id,
    title: study.acronym || study.title,
    excerpt: clip(study.objective || study.description, 700),
  })) : undefined;

  for (const i of invs) {
    cards.push({
      id: i.id,
      kind: 'investigation',
      title: i.acronym ? `${i.acronym}: ${i.title}` : i.title,
      subtitle: i.sub_research_area ?? undefined,
      url: safeSourceUrl(i.source_url) ?? '',
      investigationId: i.id,
    });
    const original = safeSourceUrl(i.source_url);
    const p = (params ?? [])
      .filter(x => x.investigation_id === i.id)
      .slice(0, 12)
      .map(x => {
        const v = x.value_text ?? (x.value_min != null || x.value_max != null ? `${x.value_min ?? '?'}–${x.value_max ?? '?'}` : x.value_num);
        if (v == null) return null;
        const url = safeSourceUrl(x.source_url);
        const id = url && url !== original ? `DATA-${cards.length + 1}` : i.id;
        if (url && id !== i.id) cards.push({id, kind: 'data', title: x.parameter_id, url, investigationId: i.id});
        return `[${id}] ${x.parameter_id}=${v}${x.unit ? ' ' + x.unit : ''} (origin=${x.origin})`;
      }).filter(Boolean);
    blocks.push(
      [
        `[${i.id}] ${i.acronym ?? ''} — ${i.title}`,
        `area: ${i.sub_research_area ?? 'n/a'}; type: ${i.project_type ?? 'n/a'}; dates: ${i.start_date ?? '?'} to ${i.end_date ?? '?'}`,
        `hardware: ${distinctHardware(i.hardware ?? []).join(', ') || 'n/a'}; platform: ${i.platform ?? 'n/a'}`,
        i.description && `description: ${clip(i.description, 500)}`,
        `listed files: ${i.file_count}; summary tables: ${i.table_count}; publications: ${i.publication_count}`,
        i.objective && `objective: ${clip(i.objective, 700)}`,
        i.hypothesis && `hypothesis: ${clip(i.hypothesis, 400)}`,
        i.approach && `approach: ${clip(i.approach, 600)}`,
        i.impacts && `impacts: ${clip(i.impacts, opts.titlesPerInvestigation ? 700 : 400)}`,
        p.length > 0 && `parameters: ${p.join('; ')}`,
      ].filter(Boolean).join('\n'),
    );
  }

  const fileOrder = new Map(opts.preferredFilePassages?.map((id, index) => [id, index]));
  const fileCandidates = [...new Map([...(rankedFiles.data ?? []), ...fileGroups.flatMap(group => group.data ?? [])].map(row => [row.id, row])).values()]
    .sort((a, b) => (fileOrder.get(a.id) ?? Infinity) - (fileOrder.get(b.id) ?? Infinity) || a.id - b.id);
  const fileRows = prioritizeStudyFiles(fileCandidates, idList.slice(0, opts.namedCount ?? idList.length), 6);
  for (const row of fileRows) {
    const url = safeSourceUrl(row.source_url);
    if (!url) continue;
    const passage = parseFileExcerpt(row.content);
    if (!passage) continue;
    const id = `FILE-${row.id}`;
    cards.push({id, kind: 'data', title: passage.file_name, subtitle: passage.location, url, investigationId: row.investigation_id ?? undefined});
    blocks.push(`[${id}] extracted file excerpt for ${row.investigation_id}: ${JSON.stringify(passage)}\nDo not infer missing units or equate test conditions across rows. Cite this file tag for its values.`);
  }

  const forInvestigation = (id: string) => {
    const seen = new Set<string>();
    return pubs.filter(p => p.investigation_id === id).sort((a, b) =>
      (preferred.get(a.url ?? '') ?? Infinity) - (preferred.get(b.url ?? '') ?? Infinity)
      || Number(Boolean(b.abstract)) - Number(Boolean(a.abstract))
      || (b.year ?? 0) - (a.year ?? 0) || a.id - b.id,
    ).filter(p => {
      const key = p.title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const byId = new Map(idList.map(id => [id, forInvestigation(id)]));
  const eligible = idList.map(id => (byId.get(id) ?? []).filter(p => p.abstract?.trim()).slice(0, opts.perInvestigation ?? 2));
  const named = opts.namedCount ?? 0;
  const roundRobin = (lists: typeof eligible) => Array.from({length: opts.perInvestigation ?? 2}, (_, index) =>
    lists.flatMap(list => list[index] ? [list[index]] : []),
  ).flat();
  const ranked = [...roundRobin(eligible.slice(0, named)), ...roundRobin(eligible.slice(named))].slice(0, opts.maxAbstracts);
  for (const p of ranked) {
    const id = `PUB-${p.id}`;
    cards.push({
      id,
      kind: 'publication',
      title: p.title,
      subtitle: [p.source === 'ntrs' ? 'NASA NTRS' : 'NASA PSI', p.authors && clip(p.authors, 60), p.year].filter(Boolean).join(' · ') || undefined,
      url: safeSourceUrl(p.url) ?? (p.doi ? safeSourceUrl(`https://doi.org/${p.doi}`) : undefined) ?? '',
      investigationId: p.investigation_id ?? undefined,
    });
    blocks.push(`[${id}] paper for ${p.investigation_id}: ${p.title} (${p.year ?? 'n.d.'})\nabstract (${p.source === 'ntrs' ? 'NTRS search matched; check direct relevance' : 'PSI listed'}): ${clip(p.abstract, 1200)}`);
  }

  // Titles provide scope when an abstract isn't included in the evidence.
  if (opts.titlesPerInvestigation) {
    const used = new Set(ranked.map(p => p.id));
    for (const invId of idList) {
      const titles = (byId.get(invId) ?? [])
        .filter(p => !used.has(p.id))
        .slice(0, opts.titlesPerInvestigation);
      if (titles.length === 0) continue;
      for (const p of titles) {
        cards.push({
          id: `PUB-${p.id}`,
          kind: 'publication',
          title: p.title,
          subtitle: [p.source === 'ntrs' ? 'NASA NTRS' : 'NASA PSI', p.authors && clip(p.authors, 60), p.year].filter(Boolean).join(' · ') || undefined,
          url: safeSourceUrl(p.url) ?? (p.doi ? safeSourceUrl(`https://doi.org/${p.doi}`) : undefined) ?? '',
          investigationId: p.investigation_id ?? undefined,
        });
      }
      blocks.push(
        `paper titles for ${invId} (title only, abstract not included):\n` +
          titles.map(p => `[PUB-${p.id}] ${clip(p.title, 220)} (${p.year ?? 'n.d.'})`).join('\n'),
      );
    }
  }

  const namedIds = new Set(idList.slice(0, opts.namedCount ?? idList.length));
  const namedStudies = invs.filter(inv => namedIds.has(inv.id)).flatMap(inv =>
    inv.acronym ? [inv.id, inv.acronym] : [inv.id],
  );
  return addChallengeReferences(
    {cards, comparisonScopes, context: blocks.join('\n\n')},
    opts.referenceQueries ?? [],
    [...namedStudies, ...(opts.referenceNames ?? [])],
    opts.referenceIds,
  );
}

/** Add reviewed references to the same evidence bundle for chat and the catalog comparison. */
function addChallengeReferences(result: Retrieved, queries: string[], names: string[], sourceIds: string[] = []): Retrieved {
  const cards = [...result.cards];
  const existingByUrl = new Map(cards.map(card => [card.url, card]));
  const references = [];
  const saved = challengeSources.filter(source => sourceIds.includes(challengeSourceLink(source).id));
  const selected = [...new Map([...saved, ...findChallengeSources(queries, names, sourceContent)].map(source => [challengeSourceLink(source).id, source])).values()].slice(0, 6);
  for (const source of selected) {
    const link = challengeSourceLink(source);
    const {url} = link;
    const existing = existingByUrl.get(url);
    const id = existing?.id ?? link.id;
    if (!existing) cards.push({id, kind: 'reference', title: source.title, url, subtitle: `${link.publisher} · ${source.year}`});
    const snapshot = (sourceContent as Record<string, {url: string; checkedOn: string; text: string; coverage: string}>)[link.id];
    const verifiedSnapshot = snapshot?.url === link.url ? snapshot : undefined;
    references.push({
      id, title: source.title, year: source.year, publisher: link.publisher, evidenceType: source.type,
      catalogAssociations: associationsForSource(link.id),
      reviewedOn: verifiedSnapshot?.checkedOn ?? challengeSourcesReviewedOn,
      coverage: verifiedSnapshot?.coverage ?? 'reviewed_summary',
      text: verifiedSnapshot?.text ?? source.summary,
    });
  }
  const context = references.length
    ? [result.context, `Reviewed challenge references (corpus reviewed ${challengeSourcesReviewedOn}):\n` + JSON.stringify(references)].filter(Boolean).join('\n\n')
    : result.context;
  return {...result, cards, context};
}
