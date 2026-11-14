// Client helpers shared by the assistant and the Compare page.

export interface SourceCardData {
  id: string;
  kind: 'investigation' | 'publication';
  title: string;
  subtitle?: string;
  url: string;
  investigationId?: string;
}

export const cardHref = (c: SourceCardData) =>
  c.kind === 'investigation' ? `/investigations/${c.id}` : c.url || `/investigations/${c.investigationId}`;

/**
 * Turns citation tags like [PSI-25] into links to the cited record. Models do not always copy ids exactly
 * ([PSI‑25] with a non-breaking hyphen, [Pub-12], [PSI-25, PUB-3]), so ids are normalised before lookup.
 */
export function linkCitations(text: string, cards: SourceCardData[]) {
  const byId = new Map(cards.map(c => [c.id, c]));
  const norm = (s: string) => s.trim().toUpperCase().replace(/[‐-―−]/g, '-');
  // Tolerates spaces inside the brackets too: "[ PUB-5027 ]".
  return text.replace(/\[\s*((?:PSI|PUB)[‐-―−-]\d+(?:\s*[,;]\s*(?:PSI|PUB)[‐-―−-]\d+)*)\s*\](?!\()/gi, (whole, list: string) => {
    const parts = list.split(/[,;]/).map(norm);
    if (!parts.some(id => byId.has(id))) return whole;
    return parts.map(id => (byId.has(id) ? `[${id}](${cardHref(byId.get(id)!)})` : `[${id}]`)).join(' ');
  })
    // Back-to-back tags ([PSI-1][PSI-2]) would render glued together as "PSI-1PSI-2".
    .replace(/\)\[(PSI|PUB)-/g, ') [$1-');
}

/** Reads a newline-delimited JSON response body and calls `onEvent` for each event. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (ev: Record<string, unknown> & {type: string}) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line) onEvent(JSON.parse(line));
  }
}
