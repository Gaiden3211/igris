import {NextRequest} from 'next/server';
import {z} from 'zod';
import {isDbConfigured, isLlmConfigured, env} from '@/lib/env';
import {complete} from '@/lib/llm';
import {json, openMetered} from '@/lib/metered';
import {recordUsage} from '@/lib/limits';
import {TITLE_PROMPT, taskContent} from '@/lib/agent/prompt';
import {parseConversationTitles} from '@/lib/conversationTitle';

export const runtime = 'nodejs';
const Body = z.object({
  surface: z.enum(['chat', 'comparison']),
  studies: z.array(z.string().max(180)).max(4),
  turns: z.array(z.object({role: z.enum(['user', 'assistant']), content: z.string().max(700)})).max(6),
}).refine(input => input.studies.length > 0 || input.turns.some(turn => turn.content.trim()));

export async function POST(req: NextRequest) {
  if (!isDbConfigured() || !isLlmConfigured()) return json(503, {error: 'not_configured'});
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, {error: 'bad_request'});
  const metered = await openMetered(req);
  if (metered instanceof Response) return metered;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(env.limits.modelTimeoutMs)]);
  try {
    const result = await complete([
      {role: 'system', content: TITLE_PROMPT},
      {role: 'user', content: taskContent(TITLE_PROMPT, body.data)},
    ], 160, signal);
    await recordUsage({visitorId: metered.visitor.id, ipHash: metered.visitor.ipHash,
      model: env.radiumModel, keySlot: result.slot, tokensIn: result.tokensIn, tokensOut: result.tokensOut,
    }).catch(() => console.error('[title] usage log failed'));
    const titles = parseConversationTitles(result.text);
    return titles ? json(200, titles, {...metered.cookie, 'cache-control': 'no-store'})
      : json(502, {error: 'invalid_title'}, metered.cookie);
  } catch (error) {
    console.warn('[title] generation failed', signal.aborted ? 'timeout-or-cancelled' : error instanceof Error ? error.name : 'unknown');
    return json(503, {error: 'title_unavailable'}, metered.cookie);
  }
}
