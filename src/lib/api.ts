import {isDbConfigured} from './env';

/** Wraps a data route: uniform errors, and a clear signal when the database is not connected yet. */
export async function dataRoute<T>(fn: () => Promise<T>): Promise<Response> {
  if (!isDbConfigured()) return Response.json({error: 'not_configured'}, {status: 503});
  try {
    return Response.json(await fn(), {headers: {'cache-control': 'public, max-age=60'}});
  } catch (err) {
    console.error('[api]', err);
    return Response.json({error: 'unavailable'}, {status: 500});
  }
}
