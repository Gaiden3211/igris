import {NextRequest} from 'next/server';
import {z} from 'zod';
import {env, isDbConfigured, isLlmConfigured} from '@/lib/env';
import {collectAnswer, json, meteredStream, openMetered} from '@/lib/metered';
import {complete, stream} from '@/lib/llm';
import {ANSWER_PROMPT, PLANNER_PROMPT, DIALOGUE_PROMPT, taskContent} from '@/lib/agent/prompt';
import {researchForChat} from '@/lib/agent/research';
import {sendGroundedAnswer, sendVerifiedAnswer} from '@/lib/agent/verify';
import {parseSearchPlan} from '@/lib/agent/plan';
import {nasaIdFromQuestion} from '@/lib/agent/nasaEvidence';
import {db} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().trim().min(1).max(env.limits.maxInputChars),
  surface: z.enum(['chat', 'comparison']).default('chat'),
  domain: z.string().max(64).regex(/^[a-z0-9-]+$/).nullable().optional(),
  // Selected comparison records preserve references in follow-ups such as "which one is newer?".
  focus: z.array(z.string().regex(/^PSI-\d{1,6}$/)).max(4).optional(),
  sourceIds: z.array(z.string().max(32).regex(/^(PSI|PUB|DATA|NTRS|REF|FILE)-\d+$/)).max(64).optional(),
  history: z
    .array(z.object({role: z.enum(['user', 'assistant']), content: z.string().max(6000)}))
    .max(8)
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!isDbConfigured() || !isLlmConfigured()) return json(503, {error: 'not_configured'});

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, {error: 'bad_request'});
  const {message, history = [], surface, domain = null, focus = [], sourceIds = []} = parsed.data;

  const screen = {surface, investigationIds: surface === 'comparison' ? focus : []};
  const metered = await openMetered(req);
  if (metered instanceof Response) return metered;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(env.limits.requestTimeoutMs)]);

  return meteredStream(metered, async (send, usage) => {
    // Step 1: plan the search (one small, non-streamed call).
    const domains = domain || focus.length > 0
      ? []
      : (await db().from('domains').select('id,name').eq('enabled', true).throwOnError()).data ?? [];
    const planned = await complete(
      [
        {role: 'system', content: `${PLANNER_PROMPT}

Available research areas: ${JSON.stringify(domains)}`},
        {role: 'user', content: taskContent(PLANNER_PROMPT, {
          availableResearchAreas: domains,
          screen,
          focusedInvestigations: focus,
          contextSourceIds: sourceIds,
          historyForReferenceOnly: history.map(turn => ({...turn, content: turn.content.slice(0, 1800)})),
          currentQuestion: message,
        })},
      ],
      450,
      signal,
    );
    usage.tokensIn += planned.tokensIn;
    usage.tokensOut += planned.tokensOut;
    usage.slot = planned.slot;
    const plan = parseSearchPlan(planned.text, message, focus, domains.map(area => area.id), sourceIds.length > 0);
    const nasaId = env.publicResearchEnabled ? nasaIdFromQuestion(message) : undefined;
    if (plan.mode === 'conversation' && !nasaId) {
      send({type: 'step', id: 'answer', status: 'running'});
      const {iterator, slot} = await stream([
        {role: 'system', content: DIALOGUE_PROMPT},
        {role: 'user', content: taskContent(DIALOGUE_PROMPT, {ANSWER_LANGUAGE: plan.language, screen, history, question: message})},
      ], env.limits.maxOutputTokens, signal);
      usage.slot = slot;
      await collectAnswer(iterator, usage, text => send({type: 'delta', text}));
      send({type: 'step', id: 'answer', status: 'complete'});
      return;
    }

    const {evidence: found, reused} = await researchForChat({plan, sourceIds, nasaId, domain, signal, send});
    send({type: 'sources', cards: found.cards});

    // Step 3: stream the grounded answer.
    send({type: 'step', id: 'answer', status: 'running'});
    const {iterator, slot} = await stream(
      [
        {role: 'system', content: ANSWER_PROMPT},
        {role: 'user', content: taskContent(ANSWER_PROMPT, {
          ANSWER_LANGUAGE: plan.language,
          screen,
          unresolvedCatalogNames: found.unresolved ?? [],
          citationIds: found.cards.map(card => card.id),
          evidence: found.context || 'No matching evidence was found.',
          question: message,
          historyForReferenceOnly: history,
        })},
      ],
      env.limits.maxOutputTokens,
      signal,
    );
    usage.slot = slot;
    if (!found.publicEvidence && (reused || (!plan.needsFiles && plan.intent !== 'compare'))) await sendGroundedAnswer(iterator, found, message, send, usage, signal);
    else await sendVerifiedAnswer(iterator, found, message, send, usage, signal);
  });
}
