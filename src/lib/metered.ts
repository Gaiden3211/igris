import type {NextRequest} from 'next/server';
import {env} from './env';
import {db} from './supabase';
import {checkLimits, recordUsage, type LimitState} from './limits';
import {getVisitor, visitorCookie} from './visitor';

// Shared by every route that spends model tokens (/api/chat, /api/compare): one quota, one usage log.

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json', ...headers}});

export interface Metered {
  visitor: ReturnType<typeof getVisitor>;
  cookie: Record<string, string>;
}

/** Identifies the visitor and checks quotas. Returns a ready error Response when the request must not go ahead. */
export async function openMetered(req: NextRequest): Promise<Metered | Response> {
  const visitor = getVisitor(req);
  const cookie: Record<string, string> = visitor.isNew ? {'set-cookie': visitorCookie(visitor.id)} : {};
  let limit: LimitState;
  try {
    if (visitor.isNew) await db().from('visitors').insert({id: visitor.id, ip_hash: visitor.ipHash});
    limit = await checkLimits(visitor.id, visitor.ipHash);
  } catch (err) {
    console.error('[metered] limit check failed', err);
    return json(503, {error: 'unavailable'}, cookie);
  }
  if (!limit.ok) return json(429, {error: 'limit', code: limit.code}, cookie);
  return {visitor, cookie};
}

export class UnverifiedAnswer extends Error {}
export class IncompleteAnswer extends Error {}

export type Send = (event: Record<string, unknown>) => void;
export interface Usage {
  tokensIn: number;
  tokensOut: number;
  slot: string;
  answer: string;
}

/**
 * Streams newline-delimited JSON events (`step`, `sources`, `delta`, `done`, `error`) and records usage at the end,
 * even when `run` fails midway, so retries cannot bypass the quota.
 */
export function meteredStream(m: Metered, run: (send: Send, usage: Usage) => Promise<void>, headers: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream({
    async start(controller) {
      const send: Send = event => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };
      const usage: Usage = {tokensIn: 0, tokensOut: 0, slot: 'primary', answer: ''};
      try {
        await run(send, usage);
        send({type: 'done'});
      } catch (err) {
        if (!cancelled) {
          if (!(err instanceof UnverifiedAnswer)) console.error('[metered] failed', err);
          else console.warn('[agent] answer withheld', err.message || 'incomplete_generation');
          send({type: 'error', code: err instanceof UnverifiedAnswer ? 'answer_unverified' : err instanceof IncompleteAnswer ? 'answer_incomplete' : 'model_unavailable'});
        }
      } finally {
        if (usage.tokensOut === 0) usage.tokensOut = Math.ceil(usage.answer.length / 4);
        await recordUsage({
          visitorId: m.visitor.id,
          ipHash: m.visitor.ipHash,
          model: env.radiumModel,
          keySlot: usage.slot,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
        }).catch(e => console.error('[metered] usage log failed', e));
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });
  return new Response(body, {
    headers: {'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', ...m.cookie, ...headers},
  });
}

/** Collects the model draft for verification while preserving streaming usage reports. */
export async function collectAnswer(
  iterator: AsyncIterable<{choices: {delta?: {content?: string | null}; finish_reason?: string | null}[]; usage?: {prompt_tokens?: number; completion_tokens?: number} | null}>,
  usage: Usage,
  onDelta?: (text: string) => void,
) {
  let finishReason: string | null = null;
  for await (const chunk of iterator) {
    if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      usage.answer += delta;
      onDelta?.(delta);
    }
    if (chunk.usage) {
      usage.tokensIn += chunk.usage.prompt_tokens ?? 0;
      usage.tokensOut += chunk.usage.completion_tokens ?? 0;
    }
  }
  // A missing completion marker or interrupted generation is not a complete draft.
  if (finishReason !== 'stop') throw new IncompleteAnswer();
  // A reasoning model can spend the whole token budget thinking and stream no visible text.
  if (!usage.answer.trim()) throw new Error('model returned no visible text');
  return usage.answer;
}
