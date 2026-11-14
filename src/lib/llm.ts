import OpenAI from 'openai';
import {env} from './env';

type Msg = OpenAI.Chat.ChatCompletionMessageParam;
type Chunk = OpenAI.Chat.ChatCompletionChunk;

async function withFailover<T>(fn: (client: OpenAI) => Promise<T>): Promise<{value: T; slot: string}> {
  let lastError: unknown = new Error('LLM_NOT_CONFIGURED');
  for (const [slot, apiKey] of Object.entries(env.radiumKeys)) {
    if (!apiKey) continue;
    const client = new OpenAI({apiKey, baseURL: env.radiumBaseUrl, timeout: 60_000, maxRetries: 0});
    try {
      return {value: await fn(client), slot};
    } catch (err) {
      lastError = err;
      console.error(`[llm] ${slot} request failed`, err instanceof OpenAI.APIError ? err.status : undefined);
    }
  }
  throw lastError;
}

export async function complete(messages: Msg[], maxTokens: number) {
  const {value, slot} = await withFailover(async client => {
    const response = await client.chat.completions.create({
      model: env.radiumModel, messages, max_tokens: maxTokens + env.limits.reasoningTokens, temperature: 0,
    });
    if (!response.choices[0]?.message?.content?.trim()) throw new Error('model returned no visible text');
    return response;
  });
  return {
    text: value.choices[0]?.message?.content ?? '',
    slot,
    tokensIn: value.usage?.prompt_tokens ?? 0,
    tokensOut: value.usage?.completion_tokens ?? 0,
  };
}

// Wait for visible content before committing to a provider stream. Retain only
// any usage events and the first visible chunk from the prelude.
async function openAnswer(response: AsyncIterable<Chunk>): Promise<AsyncIterable<Chunk>> {
  const iterator = response[Symbol.asyncIterator]();
  try {
    let usage: Chunk | undefined;
    for (;;) {
      const chunk = await iterator.next();
      if (chunk.done) throw new Error('model returned no visible text');
      if (chunk.value.choices[0]?.delta?.content?.trim()) {
        const first = chunk.value;
        return {
          async *[Symbol.asyncIterator]() {
            try {
              if (usage) yield usage;
              yield first;
              for (;;) {
                const next = await iterator.next();
                if (next.done) break;
                yield next.value;
              }
            } finally {
              await iterator.return?.();
            }
          },
        };
      }
      if (chunk.value.usage) usage = chunk.value;
    }
  } catch (error) {
    await iterator.return?.();
    throw error;
  }
}

export async function stream(messages: Msg[], maxTokens: number) {
  const {value, slot} = await withFailover(async client => {
    const response = await client.chat.completions.create({
      model: env.radiumModel,
      messages,
      max_tokens: maxTokens + env.limits.reasoningTokens,
      temperature: 0.2,
      stream: true,
      stream_options: {include_usage: true},
    });
    return openAnswer(response);
  });
  return {iterator: value, slot};
}
