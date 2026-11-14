import {NextRequest} from 'next/server';
import {z} from 'zod';
import {env, isDbConfigured, isLlmConfigured} from '@/lib/env';
import {json, meteredStream, openMetered, pipeAnswer} from '@/lib/metered';
import {stream} from '@/lib/llm';
import {COMPARE_PROMPT} from '@/lib/agent/prompt';
import {buildContext} from '@/lib/agent/retrieve';
import {COMPARE_MAX} from '@/lib/compare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  ids: z.array(z.string().regex(/^PSI-\d{1,6}$/)).min(2).max(COMPARE_MAX),
  lang: z.enum(['en', 'uk']).catch('en'),
});

/**
 * Compares 2-4 investigations picked in the Catalog. No planning step: the records are known, so the server loads
 * them (plus up to two paper abstracts each) and streams one grounded comparison. Counts as one assistant message.
 */
export async function POST(req: NextRequest) {
  if (!isDbConfigured() || !isLlmConfigured()) return json(503, {error: 'not_configured'});

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, {error: 'bad_request'});
  const ids = [...new Set(parsed.data.ids.map(id => id.toUpperCase()))];
  if (ids.length < 2) return json(400, {error: 'bad_request'});

  const metered = await openMetered(req);
  if (metered instanceof Response) return metered;

  return meteredStream(metered, async (send, usage) => {
    send({type: 'step', id: 'search', status: 'running'});
    const found = await buildContext(ids, {maxAbstracts: 8, perInvestigation: 2, titlesPerInvestigation: 4});
    send({type: 'step', id: 'search', status: 'complete', detail: String(found.cards.length)});
    send({type: 'sources', cards: found.cards});
    if (!found.context) throw new Error('no records for ' + ids.join(','));

    send({type: 'step', id: 'answer', status: 'running'});
    const {iterator, slot} = await stream(
      [
        {role: 'system', content: COMPARE_PROMPT},
        {role: 'user', content: `ANSWER_LANGUAGE: ${parsed.data.lang}\n\nSOURCES\n${found.context}\n\nCOMPARE\n${ids.join(', ')}`},
      ],
      // Four records with a table need more room than a chat answer.
      env.limits.maxOutputTokens + 600,
    );
    usage.slot = slot;
    await pipeAnswer(iterator, send, usage);
    send({type: 'step', id: 'answer', status: 'complete'});
  });
}
