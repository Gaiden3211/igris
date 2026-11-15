// Rank positions are comparable across search queries; PostgreSQL raw scores are not.
export function fuseResults<T>(lists: readonly (readonly T[])[], key: (item: T) => string, limit: number): T[] {
  const hits = new Map<string, {item: T; score: number}>();
  for (const list of lists) {
    const seen = new Set<string>();
    for (const item of list) {
      const id = key(item);
      if (seen.has(id)) continue;
      seen.add(id);
      const previous = hits.get(id);
      hits.set(id, {item: previous?.item ?? item, score: (previous?.score ?? 0) + 1 / (20 + seen.size)});
    }
  }
  return [...hits.entries()].sort(([a, x], [b, y]) => y.score - x.score || a.localeCompare(b, 'en', {numeric: true}))
    .slice(0, limit).map(([, hit]) => hit.item);
}

/** Keep explicitly selected studies' own file evidence ahead of broad search matches. */
export function prioritizeStudyFiles<T extends {id: number; investigation_id: string | null}>(
  ranked: readonly T[], selectedIds: readonly string[], limit: number,
): T[] {
  const pinned = selectedIds.flatMap(id => {
    const first = ranked.find(row => row.investigation_id === id);
    return first ? [first] : [];
  });
  return [...new Map([...pinned, ...ranked].map(row => [row.id, row])).values()].slice(0, limit);
}
