import {z} from 'zod';
import type {Retrieved} from './retrieve';

const ORIGIN = 'https://ntrs.nasa.gov';
const ID = /^\d{11}$/;
const Report = z.object({
  id: z.union([z.string(), z.number()]).transform(String).refine(value => ID.test(value)),
  title: z.string().trim().min(1).max(500),
  abstract: z.string().nullish().catch(undefined),
  downloads: z.array(z.object({
    draft: z.boolean().optional(),
    links: z.object({fulltext: z.string().optional()}).optional(),
  }).nullable().catch(null)).optional().catch(undefined),
});
type Report = z.infer<typeof Report>;

export function nasaIdFromQuestion(question: string) {
  return question.match(/\bNTRS-(\d{11})\b/i)?.[1]
    ?? question.match(/\bhttps:\/\/ntrs\.nasa\.gov\/(?:api\/)?citations\/(\d{11})(?!\d)/i)?.[1];
}

export function publicSearchTerms(queries: string[], max = 2) {
  return [...new Set(queries.map(query => query.trim().replace(/\s+/g, ' '))
    .filter(query => /^(?=.{3,100}$)[a-z\d][a-z\d ()-]+$/i.test(query)
      && /[a-z]{2}/i.test(query) && !/\d{7,}/.test(query)))].slice(0, max);
}

/** Prefer the short program title, then add a variant for distinct study objectives. */
export function comparisonSearchTerms(titles: string[]) {
  const clean = (value: string) => value.replace(/[^a-z\d ()-]/gi, ' ').slice(0, 100);
  const families = titles.map(title => clean(title.split(/\s+[-–—]\s+/)[0]));
  const topics = titles.map(title => clean(title.replace(/\b(?:experiment|investigation) unit \d+\b/gi, '')));
  return publicSearchTerms([...families, ...topics], 4);
}

async function requestText(path: string, signal: AbortSignal, accept: string, limit: number) {
  try {
    const response = await fetch(ORIGIN + path, {
      signal, redirect: 'error', cache: 'no-store', headers: {accept},
    });
    if (!response.ok || !response.body) return '';
    if (accept === 'text/plain' && !response.headers.get('content-type')?.startsWith('text/plain')) {
      void response.body.cancel().catch(() => {});
      return '';
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      while (bytes < limit) {
        const {done, value} = await reader.read();
        if (done) return text + decoder.decode();
        const available = limit - bytes;
        text += decoder.decode(value.subarray(0, available), {stream: true});
        bytes += value.length;
      }
      return accept === 'text/plain' ? text + decoder.decode() : '';
    } finally {
      void reader.cancel().catch(() => {});
    }
  } catch {
    return '';
  }
}

async function requestJson(path: string, signal: AbortSignal) {
  const text = await requestText(path, signal, 'application/json', 196_608);
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

function reportTextPath(report: Report) {
  const prefix = `/api/citations/${report.id}/downloads/`;
  for (const item of report.downloads ?? []) {
    const path = item?.links?.fulltext;
    if (item?.draft !== false || !path?.startsWith(prefix)) continue;
    const name = path.slice(prefix.length);
    // A single filename on the same citation; no slashes, queries or redirects.
    if (/^(?:[a-z\d_. -]|%20){1,180}\.txt$/i.test(name)) return path;
  }
}

const stopwords = new Set(['about', 'with', 'from', 'what', 'this', 'that', 'have', 'were', 'report', 'study', 'nasa', 'experiment', 'investigation', 'unit']);
function keywords(value: string) {
  return [...new Set(value.toLowerCase().match(/[a-z\d]{3,}/g) ?? [])].filter(word => !stopwords.has(word));
}

function excerpts(text: string, terms: string[]) {
  // NTRS provides extracted text rather than a PDF. Keep complete lines in each excerpt.
  return text.split(/\n\s*\n|\f/).flatMap(section => section.match(/[^\n]*(?:\n|$)/g)?.reduce<string[]>((blocks, line) => {
    const last = blocks.at(-1) ?? '';
    if (last && last.length + line.length <= 1400) blocks[blocks.length - 1] += line;
    else if (line.trim()) blocks.push(line.slice(0, 1400));
    return blocks;
  }, []) ?? []).map(block => block.replace(/\s+/g, ' ').trim()).filter(block => block.length >= 120)
    .map((block, index) => {
      const words = new Set(keywords(block));
      const matches = terms.filter(term => words.has(term)).length;
      return {block, index, score: matches * 2 + (/\b(results|conclusions|measured)\b/i.test(block) ? 1 : 0)};
    }).filter(item => item.score > 1 || !terms.length)
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2).map(item => item.block);
}

export async function addNasaEvidence(local: Retrieved, options: {
  queries?: string[];
  ids?: string[];
  excerptTerms?: string[];
  signal: AbortSignal;
}): Promise<Retrieved> {
  const queries = publicSearchTerms(options.queries ?? [], 4);
  const requested = [...new Set(options.ids ?? [])].filter(id => ID.test(id)).slice(0, 3);
  if (!queries.length && !requested.length) return local;
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(6500)]);
  const batches = await Promise.all([
    ...requested.map(async id => {
      const result = Report.safeParse(await requestJson(`/api/citations/${id}`, signal));
      return result.success && result.data.id === id ? [result.data] : [];
    }),
    ...queries.map(async query => {
      const params = new URLSearchParams({q: query, 'page.size': '4'});
      const data = z.object({results: z.array(z.unknown()).max(12)}).safeParse(await requestJson(`/api/citations/search?${params}`, signal));
      return data.success ? data.data.results.flatMap(value => {
        const result = Report.safeParse(value);
        if (!result.success) return [];
        const required = keywords(query);
        const available = new Set(keywords(`${result.data.title} ${result.data.abstract ?? ''}`));
        const overlap = required.filter(word => available.has(word)).length;
        return overlap >= Math.min(2, required.length) ? [result.data] : [];
      }) : [];
    }),
  ]);
  const terms = keywords((options.excerptTerms ?? queries).join(' '));
  const interleaved = Array.from({length: 4}, (_, index) => batches.flatMap(batch => batch[index] ? [batch[index]] : [])).flat();
  const unique = [...new Map(interleaved.map(report => [report.id, report])).values()].slice(0, 4);
  const records = await Promise.all(unique.map(async report => {
    const path = reportTextPath(report);
    return {
      report,
      abstract: report.abstract?.trim().slice(0, 1800) ?? '',
      passages: path ? excerpts(await requestText(path, signal, 'text/plain', 196_608), terms) : [],
    };
  }));
  const cards = [...local.cards];
  const evidence = [];
  for (const {report, abstract, passages} of records) {
    if (!abstract && !passages.length) continue;
    const url = `${ORIGIN}/citations/${report.id}`;
    const id = `NTRS-${report.id}`;
    if (!cards.some(card => card.id === id)) cards.push({id, title: report.title, url, kind: 'reference'});
    evidence.push({id, title: report.title, abstract, passages});
  }
  if (!evidence.length) return local;
  return {
    ...local, cards, publicEvidence: true,
    publicAbstracts: evidence.filter(record => record.abstract).map(({id, title, abstract}) => ({id, title, text: abstract})),
    context: [local.context, 'Live NASA NTRS reports. Search matches do not establish a link to a catalog study. Passages are partial extracted text without page numbers.\n' + JSON.stringify(evidence)].filter(Boolean).join('\n\n'),
  };
}
