import type {NextRequest} from 'next/server';
import {dataRoute} from '@/lib/api';
import {queryCatalog} from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.slice(0, 200) || undefined;
  return dataRoute(() =>
    queryCatalog({q: get('q'), domain: get('domain'), sub: get('sub'), hardware: get('hardware'), data: get('data'), sort: get('sort')}),
  );
}
