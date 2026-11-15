import {env} from '../env';
import type {Send} from '../metered';
import {addNasaEvidence, comparisonSearchTerms, nasaIdFromQuestion, publicSearchTerms} from './nasaEvidence';
import type {parseSearchPlan} from './plan';
import {getSourceContext, retrieve, type Retrieved} from './retrieve';

function reportIds(values: string[]) {
  return [...new Set(values.flatMap(value => nasaIdFromQuestion(value) ?? []))];
}

function catalogSearchOptions(local: Retrieved, queries: string[]) {
  const titles = local.cards.filter(card => card.kind === 'investigation')
    .map(card => card.title.replace(/^.*?: /, ''));
  return {
    queries: publicSearchTerms([...queries, ...comparisonSearchTerms(titles)], 4),
    ids: reportIds(local.cards.map(card => card.url)).slice(0, 2),
  };
}

async function consultNasa(local: Retrieved, options: Parameters<typeof addNasaEvidence>[1], send: Send) {
  if (!env.publicResearchEnabled || (!options.ids?.length && !options.queries?.length)) return local;
  send({type: 'step', id: 'web', status: 'running'});
  const evidence = await addNasaEvidence(local, options);
  send({type: 'step', id: 'web', status: 'complete'});
  return evidence;
}

export async function researchForChat({plan, sourceIds, nasaId, domain, signal, send}: {
  plan: ReturnType<typeof parseSearchPlan>;
  sourceIds: string[];
  nasaId?: string;
  domain: string | null;
  signal: AbortSignal;
  send: Send;
}) {
  if (nasaId) {
    const evidence = await consultNasa({cards: [], context: ''}, {
      ids: [nasaId], excerptTerms: plan.publicQueries, signal,
    }, send);
    if (evidence.context) return {evidence, reused: false};
  }

  if (plan.mode === 'context' && !plan.needsWeb && !nasaId) {
    send({type: 'step', id: 'context', status: 'running'});
    const local = await getSourceContext(sourceIds);
    const evidence = await consultNasa(local, {
      ids: reportIds(sourceIds), excerptTerms: plan.publicQueries, signal,
    }, send);
    send({type: 'step', id: 'context', status: 'complete'});
    if (evidence.context) return {evidence, reused: true};
  }

  send({type: 'step', id: 'search', status: 'running'});
  const local = await retrieve(plan.queries, plan.ids, domain ?? plan.domain, {
    broaden: !domain, namedOnly: plan.ids.length > 0 && (plan.intent === 'detail' || plan.intent === 'compare'),
    withFiles: plan.needsFiles,
  });
  send({type: 'step', id: 'search', status: 'complete'});
  const missingEvidence = !local.context || Boolean(local.unresolved?.length)
    || (plan.needsFiles && !local.cards.some(card => card.id.startsWith('FILE-')));
  const evidence = plan.needsWeb || missingEvidence
    ? await consultNasa(local, {...catalogSearchOptions(local, plan.publicQueries), signal}, send)
    : local;
  return {evidence, reused: false};
}

export function researchForComparison(local: Retrieved, signal: AbortSignal, send: Send) {
  return consultNasa(local, {...catalogSearchOptions(local, []), signal}, send);
}
