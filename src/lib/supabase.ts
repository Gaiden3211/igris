import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {env, isDbConfigured} from './env';

let client: SupabaseClient | null = null;

/** Server-only client using the secret key. RLS blocks every other key. */
export function db(): SupabaseClient {
  if (!isDbConfigured()) throw new Error('DB_NOT_CONFIGURED');
  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  return client;
}
