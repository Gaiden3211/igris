/** Decode bounded structured model output. Schema validation belongs to the caller. */
export function parseModelJson(raw: string, maxChars = 32_768): unknown {
  if (raw.length > maxChars) return null;
  const text = raw.trim().replace(/^<think>[\s\S]*?<\/think>\s*/iu, '')
    .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu, '$1');
  const candidates = [text];
  // Clarke sometimes escapes an entire object without adding the outer JSON string quotes.
  if (text.startsWith('{\\"')) {
    try {
      // Restore the omitted outer string quotes, preserving escaped quotes inside values.
      candidates.push(JSON.parse('"' + text.replace(/\r/gu, '\\r').replace(/\n/gu, '\\n') + '"') as string);
    } catch { return null; }
  }
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      return typeof value === 'string' ? JSON.parse(value) as unknown : value;
    } catch { /* Try only the single known encoding variant; do not extract arbitrary prose. */ }
  }
  return null;
}
