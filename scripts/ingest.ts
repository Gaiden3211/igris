/**
 * Imports investigation metadata from the PSI repository and related reports from NTRS into Supabase.
 *
 *   npx tsx scripts/ingest.ts            # import everything
 *   npx tsx scripts/ingest.ts --dry      # fetch and print what would be written, no database access
 *   npx tsx scripts/ingest.ts --no-ntrs  # skip the technical-reports lookup
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY (not for --dry). Neither source needs a key.
 * Values are stored as published; nothing is estimated. The full source record is kept in investigations.raw.
 */
import {createClient} from '@supabase/supabase-js';

const PSI = 'https://psi.nasa.gov/geode-py/ws/repo';
const PSI_PAGE = (id: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${id}`;
const NTRS = 'https://ntrs.nasa.gov/api/citations/search';
const DRY = process.argv.includes('--dry');
const WITH_NTRS = !process.argv.includes('--no-ntrs');

type Json = Record<string, unknown>;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getJson(url: string, tries = 3): Promise<Json> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, {headers: {accept: 'application/json', 'user-agent': 'igris-ingest (github.com/Gaiden3211/igris)'}});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Json;
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${(err as Error).message}`);
      await sleep(1000 * i);
    }
  }
}

// The PSI API is not formally documented, so field access is tolerant of naming differences.
const pick = (o: Json | undefined, ...keys: string[]): unknown => {
  if (!o) return undefined;
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[\s_]/g, ''), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase().replace(/[\s_]/g, '')];
    if (v != null && v !== '') return v;
  }
  return undefined;
};
const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(x => str(x)).filter(Boolean).join(', ') || null;
  if (typeof v === 'object') return str(pick(v as Json, 'name', 'value', 'title'));
  const s = String(v).trim();
  return s || null;
};
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter(x => x && typeof x === 'object') as Json[]) : []);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
// PSI has impossible dates such as 03-32-2023; those become null instead of failing the whole record.
const validYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? ymd : null;
};
const isoDate = (v: unknown): string | null => {
  const s = parseDate(v);
  return s ? validYmd(s) : null;
};
const parseDate = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // PSI publishes MM-DD-YYYY
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // ...and DD-Mon-YYYY for release dates (e.g. 31-Dec-2022). Parsed by hand: new Date() would use local time
  // and toISOString() could then shift the day.
  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  const month = dmy ? 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(dmy[2].toLowerCase()) / 3 + 1 : 0;
  if (dmy && month >= 1) return `${dmy[3]}-${String(month).padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// PSI spells the same topic several ways ("Flames of Gaseous Fuels", "Flames of gaseous fuel"), which split one topic
// into several filter options and chart bars. Topics are title-cased; singular/plural variants are merged by an
// explicit list, because a generic "add an s" rule would break words like Physics or Glass.
const SMALL_WORDS = new Set(['of', 'and', 'in', 'vs', 'the', 'for', 'on', 'to', 'a']);
const TOPIC_ALIASES: Record<string, string> = {
  'Droplet': 'Droplets',
  'Flames of Gaseous Fuel': 'Flames of Gaseous Fuels',
};
const titleCase = (s: string) =>
  s.split(' ').map((w, i) => {
    if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
    // Keep words that are already written with inner capitals or as abbreviations (e.g. "pNIPA", "CFD").
    if (/[A-Z]/.test(w.slice(1)) || /^[A-Z0-9-]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
const normalizeTopic = (raw: string | null): string | null => {
  if (!raw) return null;
  const parts = raw.replace(/\s+/g, ' ').trim().split(/\s*,\s*/).filter(Boolean).map(p => {
    const t = titleCase(p);
    return TOPIC_ALIASES[t] ?? t;
  });
  return parts.join(', ') || null;
};

// Hardware groupings as described in the challenge statement, as hardware codes.
const HARDWARE: [RegExp, string[]][] = [
  [/\b(ACME|BRE|CLD|E-?FIELD|Flame Design|s-?Flame|CFI-G)\b/i, ['CIR', 'ACME']],
  [/\b(FLEX|FLEX-2|CFI)\b(?!-)/i, ['CIR', 'MDCA']],
  [/\b(BASS|SPICE|SLICE)\b/i, ['MSG']],
  [/\bSaffire\b/i, ['CYGNUS']],
  [/\b(SAME|DAFT)\b/i, ['MSG']],
];
// Readable names for codes we know; they win over PSI's own spelling (which has typos such as "Appartatus").
const HARDWARE_NAMES: Record<string, string> = {
  CIR: 'Combustion Integrated Rack',
  ACME: 'ACME chamber insert (in CIR)',
  MDCA: 'Multi-user Droplet Combustion Apparatus',
  MSG: 'Microgravity Science Glovebox',
  CYGNUS: 'Cygnus cargo vehicle',
  FIR: 'Fluids Integrated Rack',
  LMM: 'Light Microscopy Module',
  FCF: 'Fluids and Combustion Facility',
  SPU: 'CSLM Sample Processing Unit',
  ECU: 'CSLM Electronic Control Unit',
  FSL: 'Fluid Science Laboratory',
  EXPRESS: 'EXPRESS Rack',
};
/**
 * Hardware labels shown in filters, e.g. "Microgravity Science Glovebox (MSG)": codes from the acronym groupings
 * plus every "Name (CODE)" pair in PSI's experimentHardware text.
 */
const hardwareFor = (text: string, psiHardware: string | null) => {
  const byCode = new Map<string, string>();
  for (const code of HARDWARE.filter(([re]) => re.test(text)).flatMap(([, h]) => h)) byCode.set(code, HARDWARE_NAMES[code] ?? code);
  for (const m of (psiHardware ?? '').matchAll(/([A-Za-z][^,;()]*?)\s*\(([A-Z][A-Za-z0-9-]{1,9})\)/g)) {
    const code = m[2].toUpperCase();
    if (!byCode.has(code)) byCode.set(code, HARDWARE_NAMES[code] ?? m[1].replace(/^(and|with)\s+/i, '').trim());
  }
  // CYGNUS and ACME are internal keys, not codes a reader would recognise, so their names stand alone.
  return [...byCode].map(([code, name]) => (code === 'CYGNUS' || code === 'ACME' || name === code ? name : `${name} (${code})`));
};

async function listInvestigationIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += 200) {
    const page = await getJson(`${PSI}/search?source=psi&type=investigation&size=200&from=${from}`);
    const hitsRoot = page.hits as Json | Json[] | undefined;
    const hits = arr(Array.isArray(hitsRoot) ? hitsRoot : (hitsRoot?.hits ?? page.results ?? page.data));
    for (const h of hits) {
      const src = (h._source as Json) ?? h;
      const id = str(pick(src, 'identifier', 'accession', 'Accession', 'Identifier', 'id')) ?? str(h._id);
      if (id && /^PSI-\d+$/i.test(id)) ids.push(id.toUpperCase());
    }
    if (hits.length < 200) break;
  }
  return [...new Set(ids)];
}

// File inventories can hold tens of thousands of entries (ACE-T2 has 62,000) and made the row too large to write.
// The counts and the largest files are stored in their own columns/table, so the raw copy keeps only a count.
const BULKY = ['added', 'removed', 'images', 'modified', 'experimentalTable'];
const slimRaw = (d: Json): Json =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => (BULKY.includes(k) && Array.isArray(v) ? [k, {omitted: true, count: v.length}] : [k, v])));

function mapInvestigation(id: string, d: Json) {
  const area = str(pick(d, 'researchArea', 'Research Area'));
  const acronym = str(pick(d, 'investigationAcronym', 'acronym'));
  const title = str(pick(d, 'title', 'projectTitle', 'proposalTitle')) ?? id;
  const added = arr(pick(d, 'added'));
  const tables = arr(pick(d, 'experimentalTable', 'experimentalTables'));
  const pubs = arr(pick(d, 'publications', 'publication'));
  const formats: Record<string, number> = {};
  for (const f of added) {
    const name = str(pick(f, 'fileName', 'name', 'file')) ?? '';
    const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : '(none)';
    formats[ext] = (formats[ext] ?? 0) + 1;
  }
  const fileRow = (f: Json, kind: 'archive' | 'experimental_table') => ({
    investigation_id: id,
    file_name: str(pick(f, 'fileName', 'name', 'file')) ?? '(unnamed)',
    bytes: num(pick(f, 'fileSize', 'size', 'bytes')),
    category: str(pick(f, 'category', 'type')),
    kind,
    restricted: Boolean(pick(f, 'restricted', 'isRestricted')),
  });
  return {
    domain: area ? {id: slug(area), name: area} : null,
    row: {
      id,
      source: 'psi',
      domain_id: area ? slug(area) : null,
      acronym,
      title,
      doi: str(pick(d, 'doi', 'DOI')),
      research_area: area,
      sub_research_area: normalizeTopic(str(pick(d, 'subResearchArea', 'Sub Research Area'))),
      project_type: str(pick(d, 'projectType', 'Project Type')),
      // PSI names these investigationStartDate / investigationEndDate (and "Investigation Start Date" in search hits).
      start_date: isoDate(pick(d, 'investigationStartDate', 'startDate', 'projectStartDate')),
      end_date: isoDate(pick(d, 'investigationEndDate', 'endDate', 'projectEndDate')),
      release_date: isoDate(pick(d, 'releaseDate', 'publicReleaseDate')),
      description: str(pick(d, 'description', 'abstract')),
      objective: str(pick(d, 'objective', 'objectives')),
      hypothesis: str(pick(d, 'hypothesis')),
      approach: str(pick(d, 'approach')),
      impacts: str(pick(d, 'researchImpacts', 'impacts', 'impact')),
      hardware: hardwareFor(`${acronym ?? ''} ${title}`, str(pick(d, 'experimentHardware'))),
      platform: str(pick(d, 'flightProgram', 'Flight Platform', 'platform', 'facility')),
      file_count: added.length,
      table_count: tables.length,
      total_bytes: num(pick(d, 'totalFileSize')),
      file_formats: formats,
      publication_count: pubs.length,
      contacts: arr(pick(d, 'contacts', 'people')).map(c => ({
        name: str(pick(c, 'name', 'fullName')) ?? ([str(c.firstName), str(c.lastName)].filter(Boolean).join(' ') || null),
        affiliation: str(pick(c, 'affiliation', 'organization')),
      })),
      source_url: PSI_PAGE(id),
      raw: slimRaw(d),
      fetched_at: new Date().toISOString(),
    },
    // Only the largest files are kept as rows; the counts above stay exact.
    files: [
      ...tables.map(f => fileRow(f, 'experimental_table')),
      ...added.map(f => fileRow(f, 'archive')).sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 60),
    ],
    publications: pubs
      .map(p => {
        const doi = str(pick(p, 'doi', 'DOI'));
        return {
          investigation_id: id,
          source: 'psi',
          external_id: doi,
          title: str(pick(p, 'title')) ?? '',
          authors: str(pick(p, 'authorList', 'authors', 'author')),
          year: num(String(str(pick(p, 'year', 'publicationDate', 'date')) ?? '').match(/\d{4}/)?.[0]),
          doi,
          url: str(pick(p, 'url', 'link')) ?? (doi ? `https://doi.org/${doi}` : null),
          abstract: str(pick(p, 'abstract')),
        };
      })
      .filter(p => p.title),
  };
}

async function ntrsFor(id: string, acronym: string | null, area: string | null) {
  if (!acronym) return [];
  const q = encodeURIComponent(`"${acronym}" microgravity ${area ?? ''}`.trim());
  const res = await getJson(`${NTRS}?q=${q}&page.size=5`).catch(() => ({results: []}) as Json);
  return arr(res.results)
    .map(r => {
      const ntrsId = str(r.id);
      const pubDate = str(pick(arr(r.publications)[0], 'publicationDate')) ?? str(r.distributionDate);
      return {
        investigation_id: id,
        source: 'ntrs',
        external_id: ntrsId,
        title: str(r.title) ?? '',
        authors: arr(r.authorAffiliations).map(a => str(pick((a.meta as Json)?.author as Json, 'name'))).filter(Boolean).slice(0, 8).join(', ') || null,
        year: num(pubDate?.match(/\d{4}/)?.[0]),
        doi: null,
        url: ntrsId ? `https://ntrs.nasa.gov/citations/${ntrsId}` : null,
        abstract: str(r.abstract),
      };
    })
    .filter(p => p.title && p.url)
    // NTRS search is fuzzy: "BASS" also returns BASS-II reports. Keep a report only if its title or abstract names
    // this exact acronym, not a longer one that starts with it.
    .filter(p => mentionsExactly(`${p.title} ${p.abstract ?? ''}`, acronym));
}

const mentionsExactly = (text: string, acronym: string) => {
  const esc = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9-])${esc}(?![A-Za-z0-9]|-[A-Za-z0-9])`, 'i').test(text);
};

async function main() {
  const ids = await listInvestigationIds();
  console.log(`PSI investigations found: ${ids.length}`);
  if (ids.length === 0) throw new Error('The PSI search returned no investigations. The API shape may have changed; run with --dry and inspect.');

  const supabase = DRY ? null : createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {auth: {persistSession: false}});
  let ok = 0;
  const failed: string[] = [];

  for (const id of ids) {
    try {
      const detail = await getJson(`${PSI}/investigations/${id}`);
      const m = mapInvestigation(id, (detail._source as Json) ?? detail);
      const ntrs = WITH_NTRS ? await ntrsFor(id, m.row.acronym, m.row.research_area) : [];
      const publications = [...new Map([...m.publications, ...ntrs].map(p => [p.source + p.title, p])).values()];
      m.row.publication_count = publications.length; // same number the Catalog shows and the detail page lists
      const chunks = [
        ...(['objective', 'hypothesis', 'approach', 'impacts', 'description'] as const)
          .filter(k => m.row[k])
          .map(k => ({investigation_id: id, section: k, content: m.row[k] as string, source_url: m.row.source_url})),
        ...publications.filter(p => p.abstract).map(p => ({investigation_id: id, section: 'abstract', content: `${p.title}. ${p.abstract}`, source_url: p.url ?? m.row.source_url})),
      ];

      if (DRY || !supabase) {
        console.log(`${id} | ${m.row.acronym ?? '-'} | ${m.row.research_area ?? '-'} | files ${m.row.file_count} | tables ${m.row.table_count} | pubs ${publications.length} | chunks ${chunks.length}`);
      } else {
        const must = async (p: PromiseLike<{error: {message: string} | null}>) => {
          const {error} = await p;
          if (error) throw new Error(error.message);
        };
        if (m.domain) await must(supabase.from('domains').upsert(m.domain, {onConflict: 'id', ignoreDuplicates: true}));
        await must(supabase.from('investigations').upsert(m.row));
        // Child rows are replaced so a re-import never leaves stale data behind.
        await must(supabase.from('files').delete().eq('investigation_id', id));
        await must(supabase.from('chunks').delete().eq('investigation_id', id));
        await must(supabase.from('publications').delete().eq('investigation_id', id));
        const dedupe = <T,>(rows: T[], key: (r: T) => string) => [...new Map(rows.map(r => [key(r), r])).values()];
        if (m.files.length) await must(supabase.from('files').insert(dedupe(m.files, f => f.kind + f.file_name)));
        if (publications.length) await must(supabase.from('publications').insert(dedupe(publications, p => p.source + p.title)));
        if (chunks.length) await must(supabase.from('chunks').insert(chunks));
      }
      ok++;
    } catch (err) {
      failed.push(id);
      console.error(`${id} failed: ${(err as Error).message}`);
    }
    await sleep(250); // be polite to the public API
  }

  console.log(`Imported ${ok} of ${ids.length}.${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`);
  if (ok === 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
