import OpenAI from 'openai';
import {env} from './env';

type Msg = OpenAI.Chat.ChatCompletionMessageParam;
const SLOTS = ['primary', 'backup'] as const;

const clients = () =>
  env.radiumKeys.map((apiKey, i) => ({
    slot: SLOTS[i] ?? `key${i}`,
    client: new OpenAI({apiKey, baseURL: env.radiumBaseUrl, timeout: 60_000, maxRetries: 0}),
  }));

/** Runs `fn` against the primary key and falls back to the backup key on any failure. */
async function withFailover<T>(fn: (c: OpenAI) => Promise<T>): Promise<{value: T; slot: string}> {
  let lastError: unknown = new Error('LLM_NOT_CONFIGURED');
  for (const {slot, client} of clients()) {
    try {
      return {value: await fn(client), slot};
    } catch (err) {
      lastError = err;
      console.error(`[llm] ${slot} key failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError;
}

export async function complete(messages: Msg[], maxTokens: number) {
  const {value, slot} = await withFailover(c =>
    c.chat.completions.create({model: env.radiumModel, messages, max_tokens: maxTokens + env.limits.reasoningTokens, temperature: 0}),
  );
  return {
    text: value.choices[0]?.message?.content ?? '',
    slot,
    tokensIn: value.usage?.prompt_tokens ?? 0,
    tokensOut: value.usage?.completion_tokens ?? 0,
  };
}

export async function stream(messages: Msg[], maxTokens: number) {
  const {value, slot} = await withFailover(c =>
    c.chat.completions.create({
      model: env.radiumModel,
      messages,
      max_tokens: maxTokens + env.limits.reasoningTokens,
      temperature: 0.2,
      stream: true,
      // Without this, OpenAI-compatible APIs never send token counts in a stream and usage is only estimated.
      stream_options: {include_usage: true},
    }),
  );
  return {iterator: value, slot};
}
