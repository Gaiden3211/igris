import {z} from 'zod';
import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage, ThreadMessageLike} from '@assistant-ui/react';
import type {Dict} from './i18n';
import {ndjsonEvents, type SourceCardData} from './citations';

export const sourceCardSchema = z.object({
  id: z.string().regex(/^(PSI|PUB|DATA|NTRS|REF|FILE)-\d+$/),
  kind: z.enum(['investigation', 'publication', 'data', 'reference']),
  title: z.string(), subtitle: z.string().optional(),
  url: z.string().refine(value => !value || /^https?:$/.test(URL.parse(value)?.protocol ?? '')),
  investigationId: z.string().regex(/^PSI-\d+$/).optional(),
});
const stepSchema = z.object({
  id: z.enum(['plan', 'context', 'search', 'web', 'answer', 'verify']),
  status: z.enum(['running', 'complete', 'error']), detail: z.string().optional(),
});
const metadataSchema = z.object({
  steps: z.array(stepSchema).default([]), cards: z.array(sourceCardSchema).default([]),
  error: z.string().optional(),
  errorCode: z.enum(['answer_unverified', 'answer_incomplete', 'model_unavailable']).optional(),
});
const storedTurn = metadataSchema.omit({steps: true}).extend({
  id: z.string().min(1).max(200), role: z.enum(['user', 'assistant']), content: z.string(),
}).transform(message => ({...message, steps: []}));
/** Parents must precede children: prevents cycles and orphaned saved branches. */
export const chatRepositorySchema = z.object({
  headId: z.string().nullable(),
  messages: z.array(z.object({parentId: z.string().nullable(), message: storedTurn})).max(160),
}).refine(repository => {
  const seen = new Set<string>();
  for (const {parentId, message} of repository.messages) {
    if (seen.has(message.id) || (parentId !== null && !seen.has(parentId))) return false;
    seen.add(message.id);
  }
  return repository.headId === null || seen.has(repository.headId);
});
export type ChatRepository = z.infer<typeof chatRepositorySchema>;
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('delta'), text: z.string()}),
  z.object({type: z.literal('replace'), text: z.string()}),
  stepSchema.extend({type: z.literal('step')}),
  z.object({type: z.literal('sources'), cards: z.array(sourceCardSchema)}),
  z.object({type: z.literal('done')}),
  z.object({type: z.literal('error'), code: z.string().optional()}),
]);
export type ChatStep = z.infer<typeof stepSchema>;
export type ChatMsg = z.infer<typeof metadataSchema> & {role: 'user' | 'assistant'; content: string};
export type HistoryItem = Pick<ChatMsg, 'role' | 'content'>;
export const assistantMsg = (content: string, cards: SourceCardData[] = []): ChatMsg => ({role: 'assistant', content, steps: [], cards});
/** Stable across history trimming and restored message branches. */
export function latestResponseText(messages: ChatMsg[]) {
  const answer = messages.findLast(message => message.role === 'assistant');
  return answer ? answer.content + (answer.error ?? '') : '';
}

export const limitText = (t: Dict, code?: string) => code === 'minute' ? t.limitMinute : code === 'global' ? t.limitGlobal : t.limitDay;
export const messageText = (message: Pick<ThreadMessage, 'content'>) => message.content.map(part => part.type === 'text' ? part.text : '').join('');
export function fromRuntimeMessage(message: ThreadMessage): ChatMsg {
  const meta = metadataSchema.safeParse(message.metadata.custom);
  return {...(meta.success ? meta.data : {steps: [], cards: []}), role: message.role === 'user' ? 'user' : 'assistant', content: messageText(message)};
}
export function toRuntimeMessage(message: ChatMsg): ThreadMessageLike {
  const {role, content, ...custom} = message;
  return {role, content, metadata: {custom}};
}
export interface ChatOptions {
  surface?: 'chat' | 'comparison';
  focus?: string[] | null;
  prefix?: HistoryItem[];
  contextCards?: SourceCardData[];
}

/** Translate our retrieval protocol into cumulative assistant-ui snapshots. */
export function createChatAdapter({t, surface = 'chat', focus, prefix = [], contextCards = [], onQuestion}: ChatOptions & {
  t: Dict; onQuestion?: (messages: ChatMsg[]) => void;
}): ChatModelAdapter {
  return {async *run({messages, abortSignal}) {
    const turns = messages.filter(m => m.role !== 'system').map(fromRuntimeMessage);
    const question = turns.at(-1)?.content.trim();
    if (!question || turns.at(-1)?.role !== 'user' || abortSignal.aborted) return;
    onQuestion?.(turns);
    const previous = turns.slice(0, -1);
    const history = [...prefix, ...previous.filter(m => m.content && !m.error).slice(-Math.max(8 - prefix.length, 2))]
      .slice(-8).map(({role, content}) => ({role, content: content.slice(0, 6000)}));
    const previousCards = previous.findLast(m => m.role === 'assistant' && m.cards.length && !m.error)?.cards ?? [];
    const sourceIds = [...new Set([...(surface === 'comparison' ? focus ?? [] : []),
      ...previousCards.map(card => card.id), ...contextCards.map(card => card.id),
    ])].slice(0, 64);
    let current = assistantMsg('');
    let finished = false;
    const snapshot = (): ChatModelRunResult => ({content: [{type: 'text', text: current.content}], metadata: {custom: {
      steps: current.steps, cards: current.cards, error: current.error, errorCode: current.errorCode,
    }}});
    const fail = (code?: string) => {
      const errorCode = code === 'answer_unverified' || code === 'answer_incomplete' ? code : 'model_unavailable';
      current = {...current, errorCode, error: errorCode === 'answer_unverified' ? t.errUnverified : errorCode === 'answer_incomplete' ? t.errIncomplete : t.errModel};
    };
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({message: question, history, focus: focus?.length ? focus : undefined, surface, sourceIds}),
        signal: AbortSignal.any([abortSignal, AbortSignal.timeout(70_000)]),
      });
      if (!response.ok || !response.body) {
        const body = z.object({code: z.string().optional()}).safeParse(await response.json().catch(() => null));
        current.error = response.status === 429 ? limitText(t, body.success ? body.data.code : undefined) : response.status === 503 ? t.errNotConfigured : t.errModel;
        yield snapshot();
        return;
      }
      for await (const raw of ndjsonEvents(response.body)) {
        if (abortSignal.aborted) return;
        const event = chatEventSchema.parse(raw);
        switch (event.type) {
          case 'delta': current = {...current, content: current.content + event.text}; break;
          case 'replace': current = {...current, content: event.text}; break;
          case 'step': current = {...current, steps: [...current.steps.filter(step => step.id !== event.id), {id: event.id, status: event.status, detail: event.detail}]}; break;
          case 'sources': current = {...current, cards: event.cards}; break;
          case 'error': fail(event.code); finished = true; break;
          case 'done': finished = true; break;
        }
        if (finished) break;
        yield snapshot();
      }
      if (!finished && !abortSignal.aborted) fail('answer_incomplete');
    } catch {
      if (abortSignal.aborted) return;
      fail();
    }
    if (abortSignal.aborted) return;
    current = {...current, steps: current.steps.map(step => step.status === 'running' ? {...step, status: 'error'} : step)};
    yield snapshot();
  }};
}
