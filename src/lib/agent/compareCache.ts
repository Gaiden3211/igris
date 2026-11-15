import {createHash, randomUUID} from 'node:crypto';
import {db} from '../supabase';
import {z} from 'zod';
import {sourceCardSchema} from '../chatAdapter';
import {env} from '../env';
import type {Retrieved} from './retrieve';
import {COMPARE_PROMPT, VERIFIER_PROMPT} from './prompt';

export function compareCacheKey(ids: string[], lang: string, evidence: Retrieved) {
  return createHash('sha256').update(JSON.stringify([
    'compare-v4', env.publicResearchEnabled, ids, lang, env.radiumModel, COMPARE_PROMPT, VERIFIER_PROMPT, evidence,
  ])).digest('hex');
}

export async function readComparison(cacheKey: string) {
  const {data} = await db().from('comparison_cache').select('answer,source_cards').eq('cache_key', cacheKey)
    .abortSignal(AbortSignal.timeout(5000)).maybeSingle().throwOnError();
  if (typeof data?.answer !== 'string') return null;
  const cards = z.array(sourceCardSchema).max(64).safeParse(data.source_cards);
  return cards.success ? {answer: data.answer, cards: cards.data} : null;
}

export async function claimComparison(cacheKey: string) {
  const leaseId = randomUUID();
  const {data} = await db().rpc('claim_comparison', {
    p_key: cacheKey,
    p_lease: leaseId,
    p_seconds: Math.ceil(env.limits.requestTimeoutMs / 1000) + 15,
  }).abortSignal(AbortSignal.timeout(5000)).throwOnError();
  return data === true ? leaseId : null;
}

export async function finishComparison(cacheKey: string, leaseId: string, answer: string | null, cards: Retrieved['cards']) {
  await db().from('comparison_cache').update({answer, source_cards: answer ? cards : null, lease_until: new Date(0).toISOString()})
    .eq('cache_key', cacheKey).eq('lease_id', leaseId).abortSignal(AbortSignal.timeout(5000)).throwOnError();
}
