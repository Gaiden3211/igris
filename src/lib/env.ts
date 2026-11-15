import {DEFAULT_DAILY_LIMIT} from './quota';

// Central, typed access to server-side configuration. Never import this from client components.
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const effort = process.env.RADIUM_REASONING_EFFORT;
const reasoningEffort: 'low' | 'medium' | 'high' = effort === 'medium' || effort === 'high' ? effort : 'low';

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? '',
  radiumBaseUrl: process.env.RADIUM_BASE_URL ?? 'https://api.radium.cloud/v1',
  radiumModel: process.env.RADIUM_MODEL ?? 'clarke-1.0',
  radiumReasoningEffort: reasoningEffort,
  radiumKeys: {
    primary: process.env.RADIUM_API_KEY?.trim(),
    backup: process.env.RADIUM_API_KEY_BACKUP?.trim(),
  },
  publicResearchEnabled: process.env.PUBLIC_RESEARCH_ENABLED !== 'false',
  ipHashSalt: process.env.IP_HASH_SALT ?? 'igris-dev-salt',
  publicUrl: process.env.RENDER_EXTERNAL_URL ?? process.env.PUBLIC_URL ?? '',
  limits: {
    enabled: process.env.LIMITS_ENABLED !== 'false',
    perMinute: num(process.env.LIMIT_PER_MINUTE, 5),
    perDay: num(process.env.LIMIT_PER_DAY, DEFAULT_DAILY_LIMIT),
    perIpDay: num(process.env.LIMIT_PER_IP_DAY, 90),
    globalPerDay: num(process.env.LIMIT_GLOBAL_PER_DAY, 600),
    maxInputChars: num(process.env.LIMIT_INPUT_CHARS, 2000),
    maxOutputTokens: num(process.env.LIMIT_OUTPUT_TOKENS, 2000),
    modelTimeoutMs: num(process.env.LIMIT_MODEL_TIMEOUT_MS, 30_000),
    requestTimeoutMs: num(process.env.LIMIT_REQUEST_TIMEOUT_MS, 60_000),
    // Reasoning models (e.g. Radium clarke-1.0) spend hidden "thinking" tokens before the visible text, and those count
    // against max_tokens. This budget is added to every call so the visible answer is not cut off. Set to 0 for a
    // model that does not reason.
    reasoningTokens: Number.isFinite(Number(process.env.LIMIT_REASONING_TOKENS)) && process.env.LIMIT_REASONING_TOKENS
      ? Number(process.env.LIMIT_REASONING_TOKENS)
      : 2000,
  },
};

export const isDbConfigured = () => Boolean(env.supabaseUrl && env.supabaseSecretKey);
export const isLlmConfigured = () => Boolean(env.radiumKeys.primary || env.radiumKeys.backup);
