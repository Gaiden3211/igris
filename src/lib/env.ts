// Central, typed access to server-side configuration. Never import this from client components.
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? '',
  radiumBaseUrl: process.env.RADIUM_BASE_URL ?? 'https://api.radium.cloud/v1',
  radiumModel: process.env.RADIUM_MODEL ?? 'tycho-1.0',
  radiumKeys: [process.env.RADIUM_API_KEY, process.env.RADIUM_API_KEY_BACKUP].filter(
    (k): k is string => Boolean(k),
  ),
  ipHashSalt: process.env.IP_HASH_SALT ?? 'igris-dev-salt',
  publicUrl: process.env.RENDER_EXTERNAL_URL ?? process.env.PUBLIC_URL ?? '',
  limits: {
    perMinute: num(process.env.LIMIT_PER_MINUTE, 5),
    perDay: num(process.env.LIMIT_PER_DAY, 30),
    perIpDay: num(process.env.LIMIT_PER_IP_DAY, 90),
    globalPerDay: num(process.env.LIMIT_GLOBAL_PER_DAY, 600),
    maxInputChars: num(process.env.LIMIT_INPUT_CHARS, 2000),
    maxOutputTokens: num(process.env.LIMIT_OUTPUT_TOKENS, 1200),
    // Reasoning models (e.g. Radium tycho-1.0) spend hidden "thinking" tokens before the visible text, and those count
    // against max_tokens. This budget is added to every call so the visible answer is not cut off. Set to 0 for a
    // model that does not reason.
    reasoningTokens: Number.isFinite(Number(process.env.LIMIT_REASONING_TOKENS)) && process.env.LIMIT_REASONING_TOKENS
      ? Number(process.env.LIMIT_REASONING_TOKENS)
      : 2000,
  },
};

export const isDbConfigured = () => Boolean(env.supabaseUrl && env.supabaseSecretKey);
export const isLlmConfigured = () => env.radiumKeys.length > 0;
