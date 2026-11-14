import {db} from './supabase';
import {env} from './env';

export type LimitCode = 'minute' | 'day' | 'global';
export interface LimitState {
  ok: boolean;
  code?: LimitCode;
  remainingToday: number;
  perDay: number;
}

async function countSince(column: 'visitor_id' | 'ip_hash' | null, value: string | null, since: Date) {
  let q = db().from('usage_events').select('id', {count: 'exact', head: true}).gte('created_at', since.toISOString());
  if (column && value) q = q.eq(column, value);
  const {count, error} = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Anonymous quota: per visitor cookie, per address (cookies can be cleared), and a global daily ceiling. */
export async function checkLimits(visitorId: string, ipHash: string): Promise<LimitState> {
  const now = Date.now();
  const minuteAgo = new Date(now - 60_000);
  const dayAgo = new Date(now - 86_400_000);
  const {perMinute, perDay, perIpDay, globalPerDay} = env.limits;

  const [vMinute, ipMinute, vDay, ipDay, globalDay] = await Promise.all([
    countSince('visitor_id', visitorId, minuteAgo),
    countSince('ip_hash', ipHash, minuteAgo),
    countSince('visitor_id', visitorId, dayAgo),
    countSince('ip_hash', ipHash, dayAgo),
    countSince(null, null, dayAgo),
  ]);

  const remainingToday = Math.max(0, Math.min(perDay - vDay, perIpDay - ipDay));
  if (globalDay >= globalPerDay) return {ok: false, code: 'global', remainingToday, perDay};
  if (remainingToday <= 0) return {ok: false, code: 'day', remainingToday: 0, perDay};
  if (Math.max(vMinute, ipMinute) >= perMinute) return {ok: false, code: 'minute', remainingToday, perDay};
  return {ok: true, remainingToday, perDay};
}

export async function recordUsage(e: {
  visitorId: string;
  ipHash: string;
  model: string;
  keySlot: string;
  tokensIn: number;
  tokensOut: number;
}) {
  await db().from('usage_events').insert({
    visitor_id: e.visitorId,
    ip_hash: e.ipHash,
    model: e.model,
    key_slot: e.keySlot,
    tokens_in: e.tokensIn,
    tokens_out: e.tokensOut,
  });
}
