import {NextRequest} from 'next/server';
import {z} from 'zod';
import {env, isDbConfigured, isLlmConfigured} from '@/lib/env';
import {json, meteredStream, openMetered, pipeAnswer} from '@/lib/metered';
import {complete, stream} from '@/lib/llm';
import {ANSWER_PROMPT, PLANNER_PROMPT, SMALLTALK_HINT} from '@/lib/agent/prompt';
import {retrieve} from '@/lib/agent/retrieve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().trim().min(1).max(env.limits.maxInputChars),
  chatId: z.string().uuid().optional(),
  domain: z.string().max(64).regex(/^[a-z0-9-]+$/).nullable().optional(),
  // Investigations the conversation is about (a chat opened from the Compare page). They are always retrieved, because
  // the planner sees only the latest message and a follow-up like "which one is newer?" names none of them.
  focus: z.array(z.string().regex(/^PSI-\d{1,6}$/)).max(4).optional(),
  history: z
    .array(z.object({role: z.enum(['user', 'assistant']), content: z.string().max(6000)}))
    .max(8)
    .optional(),
});

const Plan = z.object({
  language: z.enum(['en', 'uk']).catch('en'),
  intent: z.enum(['search', 'detail', 'compare', 'smalltalk', 'off_topic']).catch('search'),
  queries: z.array(z.string().max(120)).max(3).catch([]),
  ids: z.array(z.string().max(40)).max(6).catch([]),
});

export async function POST(req: NextRequest) {
  if (!isDbConfigured() || !isLlmConfigured()) return json(503, {error: 'not_configured'});

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, {error: 'bad_request'});
  const {message, history = [], domain = null, focus = []} = parsed.data;

  const metered = await openMetered(req);
  if (metered instanceof Response) return metered;

  return meteredStream(metered, async (send, usage) => {
    // Step 1: plan the search (one small, non-streamed call).
    send({type: 'step', id: 'plan', status: 'running'});
    const planned = await complete(
      [
        {role: 'system', content: PLANNER_PROMPT},
        {role: 'user', content: message},
      ],
      200,
    );
    usage.tokensIn += planned.tokensIn;
    usage.tokensOut += planned.tokensOut;
    usage.slot = planned.slot;
    let plan = Plan.parse({});
    try {
      plan = Plan.parse(JSON.parse(planned.text.slice(planned.text.indexOf('{'), planned.text.lastIndexOf('}') + 1)));
    } catch {
      plan = {...plan, queries: [message.slice(0, 100)]};
    }
    if (plan.queries.length === 0 && plan.intent !== 'smalltalk' && plan.intent !== 'off_topic') {
      plan.queries = [message.slice(0, 100)];
    }
    send({type: 'step', id: 'plan', status: 'complete', detail: plan.queries.join(' · ')});

    // With a focus, a follow-up is about those records even if the planner took it for small talk.
    if (focus.length > 0 && (plan.intent === 'smalltalk' || plan.intent === 'off_topic')) {
      plan.intent = 'compare';
      if (plan.queries.length === 0) plan.queries = [message.slice(0, 100)];
    }

    // Step 2: retrieve cited context from the database.
    let context = '';
    if (plan.intent !== 'smalltalk' && plan.intent !== 'off_topic') {
      send({type: 'step', id: 'search', status: 'running'});
      // Focus ids first so they are never pushed out of the 8-record context by search hits.
      const found = await retrieve(plan.queries, [...focus, ...plan.ids], domain);
      context = found.context;
      send({type: 'step', id: 'search', status: 'complete', detail: String(found.cards.length)});
      send({type: 'sources', cards: found.cards});
    }

    // Step 3: stream the grounded answer.
    send({type: 'step', id: 'answer', status: 'running'});
    const sourcesBlock =
      plan.intent === 'smalltalk' || plan.intent === 'off_topic'
        ? SMALLTALK_HINT
        : context
          ? `SOURCES\n${context}`
          : 'SOURCES\n(none found for this question)';
    const {iterator, slot} = await stream(
      [
        {role: 'system', content: ANSWER_PROMPT},
        ...history.map(h => ({role: h.role, content: h.content})),
        {role: 'user', content: `ANSWER_LANGUAGE: ${plan.language}\n\n${sourcesBlock}\n\nQUESTION\n${message}`},
      ],
      env.limits.maxOutputTokens,
    );
    usage.slot = slot;
    await pipeAnswer(iterator, send, usage);
    send({type: 'step', id: 'answer', status: 'complete'});
  });
}
