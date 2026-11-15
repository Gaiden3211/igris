interface Publication {
  source: string;
  title: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  year: number | null;
  authors: string | null;
}
type VerifiedPublication = Omit<Publication, 'source'>;

const normalizeTitle = (title: string) => title.normalize('NFKC').toLowerCase()
  .replace(/\s*\(\d{4}\)\s*$/, '').replace(/[^\p{L}\p{N}]/gu, '');
export const publicationKey = (paper: Pick<Publication, 'source' | 'title'>) => JSON.stringify([paper.source, paper.title]);

/** Keep audited bibliographic repairs when a publisher supplies only a title on reimport. */
export function mergePublications<T extends Publication>(candidates: T[], existing: VerifiedPublication[]) {
  const verified = new Map(existing.filter(paper => paper.abstract?.trim()).map(paper => [normalizeTitle(paper.title), paper]));
  return [...new Map(candidates.map(paper => [publicationKey(paper), paper])).values()]
    .map(paper => {
      const saved = verified.get(normalizeTitle(paper.title));
      return {
        ...paper,
        doi: saved?.doi ?? paper.doi,
        url: saved?.url ?? paper.url,
        abstract: paper.abstract?.trim() || saved?.abstract || null,
        year: saved?.year ?? paper.year,
        authors: paper.authors || saved?.authors || null,
      };
    })
    .filter(paper => Boolean(paper.url && paper.abstract?.trim()));
}
