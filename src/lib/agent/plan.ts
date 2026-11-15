import {z} from 'zod';
import {parseModelJson} from './modelJson';

const Plan = z.object({
  mode: z.enum(['conversation', 'context', 'search']).optional().catch(undefined),
  needsWeb: z.boolean().optional().catch(undefined),
  publicQueries: z.array(z.string().max(100)).max(2).catch([]),
  needsFiles: z.boolean().optional().catch(undefined),
  language: z.enum(['en', 'uk']).optional().catch(undefined),
  intent: z.enum(['search', 'detail', 'compare', 'smalltalk', 'off_topic']).catch('search'),
  queries: z.array(z.string().trim().max(120).catch('')).catch([]),
  ids: z.array(z.string().max(40).catch('')).catch([]),
  domain: z.string().max(64).nullable().catch(null),
});

function normalizeStudyName(name: string): string {
  return name.normalize('NFKC').replace(/[‐-―−]/g, '-').trim().toUpperCase();
}

/** Allow literal names without database wildcards; PSI accessions must match exactly. */
export function studyNames(names: string[]): string[] {
  return [...new Set(names.map(normalizeStudyName)
    .filter(name => /^[A-Z0-9][A-Z0-9 .()+/-]{0,39}$/.test(name)
      && (!name.startsWith('PSI-') || /^PSI-\d{1,6}$/.test(name))))].slice(0, 10);
}

/** Model output proposes a plan; server-side rules control its bounds and exact references. */
export function parseSearchPlan(text: string, message: string, focus: string[] = [], domains: string[] = [], hasContext = false) {
  const parsed = Plan.safeParse(parseModelJson(text));
  const plan = parsed.success ? parsed.data : Plan.parse({});
  const accessions = normalizeStudyName(message).match(/\bPSI-\d{1,6}\b/g) ?? [];
  const conversational = !accessions.length && (plan.mode === 'conversation' || plan.intent === 'smalltalk' || plan.intent === 'off_topic');
  const mode = conversational ? 'conversation' : plan.mode === 'context' && hasContext ? 'context' : 'search';
  // A new topic does not inherit unrelated comparison studies.
  const mentionsNewStudy = accessions.length > 0 || plan.ids.some(name => normalizeStudyName(message).includes(normalizeStudyName(name)));
  const carryFocus = mode === 'context' || plan.intent === 'compare' || !mentionsNewStudy;
  const ids = conversational ? [] : studyNames([...accessions, ...(carryFocus ? focus : []), ...plan.ids.slice(0, 6)]);
  const hasStudy = ids.length > 0;
  const intent = hasStudy && (plan.intent === 'smalltalk' || plan.intent === 'off_topic')
    ? (ids.length > 1 ? 'compare' : 'detail') : plan.intent;
  const needsSearch = intent !== 'smalltalk' && intent !== 'off_topic';
  const queries = [...new Set(plan.queries.filter(Boolean))].slice(0, 3);
  return {
    mode,
    needsWeb: plan.needsWeb === true,
    publicQueries: plan.publicQueries,
    needsFiles: plan.needsFiles ?? true,
    language: plan.language ?? (/[\u0400-\u04FF]/.test(message) ? 'uk' : 'en'),
    intent,
    queries: needsSearch ? (queries.length ? queries : [message.trim().slice(0, 100)]) : [],
    ids,
    domain: plan.domain && domains.includes(plan.domain) ? plan.domain : null,
  };
}
