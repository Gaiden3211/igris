/** One parser for saved file excerpts, used at import and retrieval boundaries. */
export interface FileExcerpt {
  file_name: string;
  location: string;
  text: string;
  header?: string;
  checkedOn: string;
  coverage: string;
}

export function parseFileExcerpt(content: string): FileExcerpt | null {
  if (content.length > 20000) return null;
  try {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (typeof row.file_name !== 'string' || !row.file_name.trim()
      || typeof row.location !== 'string' || !row.location.trim()
      || typeof row.text !== 'string' || !row.text.trim()
      || typeof row.checkedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.checkedOn)
      || typeof row.coverage !== 'string'
      || (row.header !== undefined && typeof row.header !== 'string')) return null;
    return {file_name: row.file_name, location: row.location, text: row.text,
      checkedOn: row.checkedOn, coverage: row.coverage, header: row.header};
  } catch {
    return null;
  }
}
