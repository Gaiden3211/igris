import {z} from 'zod';

// Reject fragments and formatting rather than silently clipping a model title.
const title = z.string().trim().min(2).max(48)
  .refine(value => value.split(/\s+/u).length <= 6 && !/[\n\r…·]|\.{2,}|[<>\[\]{}#*`]/u.test(value));
export const conversationTitlesSchema = z.object({
  en: title.refine(value => /[a-z]/iu.test(value)),
  uk: title.refine(value => /[а-яіїєґ]/iu.test(value)),
});
export type ConversationTitles = z.infer<typeof conversationTitlesSchema>;

/** Some OpenAI-compatible models return fenced or once-escaped JSON. */
export function parseConversationTitles(raw: string): ConversationTitles | null {
  if (raw.length > 2000) return null;
  const text = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu, '$1');
  const candidates = [text];
  if (text.startsWith('{\\"')) candidates.push(text.replace(/\\"/gu, '"'));
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const value: unknown = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      const titles = conversationTitlesSchema.safeParse(value);
      if (titles.success) return titles.data;
    } catch { /* Try the single known provider encoding variant, never arbitrary prose. */ }
  }
  return null;
}
