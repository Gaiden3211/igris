import {NextRequest} from 'next/server';
import {z} from 'zod';
import {env, isDbConfigured, isLlmConfigured} from '@/lib/env';
import {json, meteredStream, openMetered} from '@/lib/metered';
import {stream} from '@/lib/llm';
import {COMPARE_PROMPT, taskContent} from '@/lib/agent/prompt';
import {buildContext, type Retrieved} from '@/lib/agent/retrieve';
import {sendVerifiedAnswer} from '@/lib/agent/verify';
import {claimComparison, compareCacheKey, finishComparison, readComparison} from '@/lib/agent/compareCache';
import {inspectAnswerCitations} from '@/lib/citations';
import {researchForComparison} from '@/lib/agent/research';
import {COMPARE_MAX} from '@/lib/compare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  ids: z.array(z.string().regex(/^PSI-\d{1,6}$/)).min(2).max(COMPARE_MAX),
  lang: z.enum(['en', 'uk']).catch('en'),
  regenerate: z.boolean().default(false),
});

const publicResearchHeaders = {'x-comparison-public-research': env.publicResearchEnabled ? 'enabled' : 'disabled'};

function cached(answer: string, cards: Retrieved['cards']) {
  return new Response([
    {type: 'sources', cards}, {type: 'delta', text: answer}, {type: 'done'},
  ].map(event => JSON.stringify(event)).join('\n') + '\n', {
    headers: {'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-comparison-cache': 'hit', ...publicResearchHeaders},
  });
}

function catalogComparison(found: Retrieved, lang: 'en' | 'uk') {
  const scopes = found.comparisonScopes;
  if (!scopes || scopes.filter(study => study.excerpt).length < 2) return null;
  const uk = lang === 'uk';
  const escape = (value: string) => value.replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&');
  const intro = uk
    ? 'Не вдалося підтвердити висновки з чернетки. Нижче — витяги про цілі досліджень із записів каталогу мовою оригіналу.'
    : 'The draft’s findings could not be verified. These excerpts describe the scope of each study in the catalog.';
  const items = scopes.map(study => {
    const objective = study.excerpt ? escape(study.excerpt) : uk ? 'Мету в записі не вказано.' : 'No objective is listed in the record.';
    return `- **${escape(study.title)}:** ${objective} [${study.id}]`;
  });
  const known = found.cards.map(card => card.id);
  const reports = (found.publicAbstracts ?? []).flatMap(({id, title, text}) => {
    const excerpt = text.replace(/\s+/g, ' ').trim();
    const clipped = excerpt.length > 550 ? excerpt.slice(0, 550).replace(/\s+\S*$/, '') + '…' : excerpt;
    const entry = `- **${escape(title)}:** ${escape(clipped)} [${id}]`;
    return inspectAnswerCitations(entry, known).valid ? [entry] : [];
  }).slice(0, 2);
  const reportLabel = uk
    ? 'Уривки анотацій NASA за темою. Їхній зв’язок із конкретними записами каталогу потребує перевірки.'
    : 'Excerpts from related NASA abstracts. Their connection to individual catalog records needs verification.';
  const answer = [intro, items.join('\n'), ...(reports.length ? [reportLabel, reports.join('\n')] : [])].join('\n\n');
  return inspectAnswerCitations(answer, known).valid ? answer : null;
}

/** Compare the selected public records and reuse answers for the same evidence. */
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) return json(503, {error: 'not_configured'});
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, {error: 'bad_request'});
  const {lang, regenerate} = parsed.data;
  const ids = [...new Set(parsed.data.ids)].sort();
  if (ids.length < 2) return json(400, {error: 'bad_request'});

  try {
    const found = await buildContext(ids, {maxAbstracts: 8, perInvestigation: 2, titlesPerInvestigation: 4, includeComparisonScopes: true});
    if (found.cards.filter(card => card.kind === 'investigation').length !== ids.length) {
      return json(404, {error: 'missing_investigations'});
    }
    const cacheKey = compareCacheKey(ids, lang, found);
    const existing = regenerate ? null : await readComparison(cacheKey);
    if (existing) return cached(existing.answer, existing.cards);
    if (!isLlmConfigured()) return json(503, {error: 'not_configured'});

    const metered = await openMetered(req);
    if (metered instanceof Response) return metered;
    // Explicit regenerations are metered independently and preserve the shared cached answer.
    const leaseId = regenerate ? null : await claimComparison(cacheKey);
    if (!regenerate && !leaseId) {
      const completed = await readComparison(cacheKey);
      return completed ? cached(completed.answer, completed.cards) : json(409, {error: 'comparison_pending'}, {
        ...metered.cookie, 'retry-after': '2',
      });
    }

    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(env.limits.requestTimeoutMs)]);
    return meteredStream(metered, async (send, usage) => {
      let answer: string | null = null;
      let evidence = found;
      try {
        evidence = await researchForComparison(found, signal, send);
        send({type: 'sources', cards: evidence.cards});
        send({type: 'step', id: 'answer', status: 'running'});
        const {iterator, slot} = await stream([
          {role: 'system', content: COMPARE_PROMPT},
          {role: 'user', content: taskContent(COMPARE_PROMPT, {
            ANSWER_LANGUAGE: lang, evidence: evidence.context, citationIds: evidence.cards.map(card => card.id), compare: ids,
          })},
        ], env.limits.maxOutputTokens + 600, signal);
        usage.slot = slot;
        answer = await sendVerifiedAnswer(iterator, evidence, `Compare ${ids.join(', ')}`, send, usage, signal);
      } catch (err) {
        req.signal.throwIfAborted();
        answer = catalogComparison(evidence, lang);
        if (!answer) throw err;
        console.warn('[compare] showing catalog excerpts after model failure', err instanceof Error ? err.name : 'unknown');
        send({type: 'delta', text: answer});
      } finally {
        if (leaseId) await finishComparison(cacheKey, leaseId, answer, evidence.cards).catch(error => console.error('[compare] cache write failed', error));
      }
    }, publicResearchHeaders);
  } catch (error) {
    console.error('[compare] could not prepare comparison', error);
    return json(503, {error: 'comparison_unavailable'});
  }
}
