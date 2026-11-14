import {createHash, randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {env} from './env';

export const VISITOR_COOKIE = 'igris_vid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getVisitor(req: NextRequest) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNew = !existing || !UUID.test(existing);
  const id = isNew ? randomUUID() : existing!;
  // Render puts the client address first in x-forwarded-for.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  // Only a salted hash is stored, never the address itself.
  const ipHash = createHash('sha256').update(env.ipHashSalt + ip).digest('hex').slice(0, 32);
  return {id, ipHash, isNew};
}

export const visitorCookie = (id: string) =>
  `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
