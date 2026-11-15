import {z} from 'zod';
import {complete, type stream} from '../llm';
import {collectAnswer, UnverifiedAnswer, type Send, type Usage} from '../metered';
import type {Retrieved} from './retrieve';
import {VERIFIER_PROMPT, taskContent} from './prompt';
import {inspectAnswerCitations, stripCitationDestinations} from '../citations';
import {env} from '../env';

const Verdict = z.object({
  verdict: z.enum(['supported', 'no_claims', 'revised', 'unsupported']),
  answer: z.string().trim().min(1).max(16000).optional(),
}).strict();

async function verifyAnswer(text: string, found: Retrieved, question: string, usage: Usage, signal?: AbortSignal) {
  text = stripCitationDestinations(text);
  const citations = inspectAnswerCitations(text, found.cards.map(card => card.id));

  const review = await complete([
    {role: 'system', content: VERIFIER_PROMPT},
    {role: 'user', content: taskContent(VERIFIER_PROMPT, {
      question,
      evidence: found.context,
      namedStudiesWithoutCatalogRecords: found.unresolved ?? [],
      draft: text,
      citationCheckPassed: citations.valid,
      citationIds: found.cards.map(card => card.id),
    })},
  ], env.limits.maxOutputTokens + 600, signal);
  usage.tokensIn += review.tokensIn;
  usage.tokensOut += review.tokensOut;
  const reviewText = review.text.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
  const fencedReview = reviewText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const parsed = Verdict.safeParse(parseJson(reviewText) ?? (fencedReview ? parseJson(fencedReview) : null));
  if (!parsed.success) throw new Error('invalid reviewer response');
  if (parsed.data.verdict === 'revised' && parsed.data.answer) {
    const revised = stripCitationDestinations(parsed.data.answer);
    if (!inspectAnswerCitations(revised, found.cards.map(card => card.id)).valid) throw new UnverifiedAnswer('invalid_revised_citations');
    return revised;
  }
  if (citations.valid && (parsed.data.verdict === 'no_claims'
    || (parsed.data.verdict === 'supported' && citations.ids.length > 0 && Boolean(found.context)))) return text;
  throw new UnverifiedAnswer(citations.valid ? 'review_rejected' : 'invalid_draft_citations');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sendVerifiedAnswer(
  iterator: Awaited<ReturnType<typeof stream>>['iterator'],
  found: Retrieved,
  question: string,
  send: Send,
  usage: Usage,
  signal: AbortSignal,
) {
  const draft = await collectAnswer(iterator, usage);
  signal.throwIfAborted();
  send({type: 'step', id: 'answer', status: 'complete'});
  send({type: 'step', id: 'verify', status: 'running'});
  const answer = await verifyAnswer(draft, found, question, usage, signal);
  signal.throwIfAborted();
  send({type: 'step', id: 'verify', status: 'complete'});
  send({type: 'delta', text: answer});
  return answer;
}

/** Stream grounded paragraphs; reserve semantic review for complex work or a citation repair. */
export async function sendGroundedAnswer(
  iterator: Awaited<ReturnType<typeof stream>>['iterator'], found: Retrieved, question: string, send: Send, usage: Usage, signal: AbortSignal,
) {
  const known = found.cards.map(card => card.id);
  let pending = '';
  let needsRepair = false;
  const publish = (paragraph: string) => {
    if (inspectAnswerCitations(paragraph, known).valid) send({type: 'delta', text: paragraph});
    else needsRepair = true;
  };
  const answer = await collectAnswer(iterator, usage, text => {
    pending += text;
    let end: number;
    while ((end = pending.indexOf('\n\n')) >= 0) {
      publish(pending.slice(0, end + 2));
      pending = pending.slice(end + 2);
    }
  });
  if (pending) publish(pending);
  signal.throwIfAborted();
  if (needsRepair || !inspectAnswerCitations(answer, known).valid) {
    send({type: 'step', id: 'verify', status: 'running'});
    const corrected = await verifyAnswer(answer, found, question, usage, signal);
    signal.throwIfAborted();
    send({type: 'replace', text: corrected});
    send({type: 'step', id: 'verify', status: 'complete'});
  }
  send({type: 'step', id: 'answer', status: 'complete'});
}
