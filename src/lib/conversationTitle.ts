import {z} from 'zod';
import {parseModelJson} from './agent/modelJson';

// Reject fragments and formatting rather than silently clipping a model title.
const title = z.string().trim().min(2).max(48)
  .refine(value => value.split(/\s+/u).length <= 6 && !/[\n\r…·]|\.{2,}|[<>\[\]{}#*`]/u.test(value));
export const conversationTitlesSchema = z.object({
  en: title.refine(value => /[a-z]/iu.test(value)),
  uk: title.refine(value => /[а-яіїєґ]/iu.test(value)),
});
export type ConversationTitles = z.infer<typeof conversationTitlesSchema>;

/** Title schemas stay strict even when the provider wraps or escapes its JSON. */
export function parseConversationTitles(raw: string): ConversationTitles | null {
  const titles = conversationTitlesSchema.safeParse(parseModelJson(raw, 2000));
  return titles.success ? titles.data : null;
}
