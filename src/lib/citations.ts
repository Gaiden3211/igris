// Citation parsing shared by server verification and client rendering.

const normalizeCitationId = (id: string) => id.trim().toUpperCase().replace(/[‐-―−]/g, '-');
const citationId = /^(PSI|PUB|DATA|NTRS|REF|FILE)-\d+$/;

function parseCitationTag(tag: string): string[] | null {
  const ids = tag.split(/[,;]/).map(normalizeCitationId);
  return ids.every(id => citationId.test(id)) ? ids : null;
}

/** Reject unknown/malformed citations and authored destinations before semantic review. */
export function inspectAnswerCitations(text: string, known: string[]) {
  const knownIds = new Set(known);
  const ids: string[] = [];
  let valid = true;
  for (const match of text.matchAll(/\[([^\[\]\n]+)\]/g)) {
    if (!/(?:^|[,;])\s*(?:PSI|PUB|DATA|NTRS|REF|FILE)[‐-―−-]/i.test(match[1])) continue;
    const parsed = parseCitationTag(match[1]);
    if (!parsed) valid = false;
    else ids.push(...parsed);
  }
  // The UI creates destinations exclusively from source cards.
  const hasDestination = /\]\(|^\s*\[[^\]\n]+\]:|https?:\/\/|www\.|<\/?[a-z][^>]*>/im.test(text);
  return {ids, valid: valid && !hasDestination && ids.every(id => knownIds.has(id))};
}

/** Discard model-authored destinations, keeping the citation for canonical linking. */
export function stripCitationDestinations(text: string) {
  return text.replace(/\[([^\[\]\n]+)\]\((?:<[^>\n]+>|https?:\/\/[^)\s]+)\)/gi, (match, label: string) =>
    parseCitationTag(label) ? `[${label}]` : match);
}

export interface SourceCardData {
  id: string;
  kind: 'investigation' | 'publication' | 'data' | 'reference';
  title: string;
  subtitle?: string;
  url: string;
  investigationId?: string;
}

export function safeSourceUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export const cardHref = (c: SourceCardData) => {
  if (c.kind === 'investigation' && /^PSI-\d{1,6}$/.test(c.id)) return `/investigations/${c.id}`;
  return safeSourceUrl(c.url);
};

/**
 * Turns citation tags like [PSI-25] into links to the cited record. Models do not always copy ids exactly
 * ([PSI‑25] with a non-breaking hyphen, [Pub-12], [PSI-25, PUB-3]), so ids are normalised before lookup.
 */
export function linkCitations(text: string, cards: SourceCardData[]) {
  const byId = new Map(cards.map(c => [c.id, cardHref(c)]));
  // Tolerates spaces inside the brackets too: "[ PUB-5027 ]".
  return text.replace(/\[\s*((?:PSI|PUB|DATA|NTRS|REF|FILE)[‐-―−-]\d+(?:\s*[,;]\s*(?:PSI|PUB|DATA|NTRS|REF|FILE)[‐-―−-]\d+)*)\s*\](?!\()/gi, (_whole, list: string) => {
    const parts = parseCitationTag(list) ?? [];
    return parts.filter(id => byId.has(id)).map(id => {
      const href = byId.get(id);
      return href ? `[${id}](<${href}>)` : `[${id}]`;
    }).join(' ');
  })
    // Back-to-back tags ([PSI-1][PSI-2]) would render glued together as "PSI-1PSI-2".
    .replace(/\)\[(PSI|PUB|DATA|NTRS|REF|FILE)-/g, ') [$1-');
}

/** Yields complete events even when a JSON line spans multiple network chunks. */
export async function* ndjsonEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) yield JSON.parse(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (ev: Record<string, unknown> & {type: string}) => void) {
  for await (const event of ndjsonEvents(body)) {
    if (!event || typeof event !== 'object' || !('type' in event) || typeof event.type !== 'string') throw new Error('Invalid stream event');
    onEvent(event as Record<string, unknown> & {type: string});
  }
}
