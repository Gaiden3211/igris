import {db} from '@/lib/supabase';
import {isDbConfigured, isLlmConfigured} from '@/lib/env';

export const dynamic = 'force-dynamic';

// Pinged every 10 minutes (self-ping + GitHub Actions) so the free instance stays awake
// and the database keeps seeing activity.
export async function GET() {
  let database: 'ok' | 'error' | 'not_configured' = 'not_configured';
  if (isDbConfigured()) {
    const {error} = await db().from('domains').select('id', {head: true, count: 'exact'});
    database = error ? 'error' : 'ok';
  }
  return Response.json({status: 'ok', database, assistant: isLlmConfigured() ? 'ok' : 'not_configured', time: new Date().toISOString()});
}
