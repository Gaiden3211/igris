// Shared by the Catalog selection, the Compare page and /api/compare.
export const COMPARE_MAX = 4;

export const compareHref = (ids: Iterable<string>) => `/compare?ids=${[...ids].map(encodeURIComponent).join(',')}`;
