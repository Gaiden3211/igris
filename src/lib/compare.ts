// Shared by the Catalog selection, the Compare page and /api/compare.
export const COMPARE_MAX = 4;

export const compareHref = (ids: Iterable<string>) => `/compare?ids=${[...ids].map(encodeURIComponent).join(',')}`;

export function comparisonIds(raw: string) {
  return [...new Set(raw.split(',').map(id => id.trim().toUpperCase()).filter(id => /^PSI-\d{1,6}$/.test(id)))].slice(0, COMPARE_MAX);
}

export const comparisonKey = (ids: string[]) => `comparison:${[...ids].sort().join(',')}`;
