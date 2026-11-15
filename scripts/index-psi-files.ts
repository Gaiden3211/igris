/** Apply bounded PSI file excerpts without replacing investigation metadata or other evidence. */
import {createClient} from '@supabase/supabase-js';
import passages from '../data/psi-file-passages.json';
import manifest from '../src/lib/psi-file-status.json';
import {parseFileExcerpt} from '../src/lib/agent/file-evidence';
import {createHash} from 'node:crypto';

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {auth: {persistSession: false}});
  if (!manifest.records.length || !passages.length) throw new Error('Refusing to replace a file index with empty input');
  const files = new Map(manifest.records.map(row => [row.investigation_id + '|' + row.file_name, row]));
  if (files.size !== manifest.records.length) throw new Error('Duplicate file manifest entry');
  const expectedCounts = new Map<string, number>();
  const ids = [...new Set(manifest.records.map(row => row.investigation_id))];
  const {data: investigations} = await db.from('investigations').select('id').in('id', ids).throwOnError();
  if (investigations?.length !== ids.length) throw new Error('File manifest contains unknown investigations');
  const expected = new Map<string, typeof passages[number]>();
  for (const row of passages) {
    const url = new URL(row.source_url);
    if (url.origin !== 'https://psi.nasa.gov' || url.username || url.password
      || url.pathname !== `/geode-py/ws/studies/${row.investigation_id}/download`
      || [...url.searchParams.keys()].some(key => !['file', 'version'].includes(key))) throw new Error('Invalid stable NASA file URL');
    const excerpt = parseFileExcerpt(row.content);
    if (!excerpt) throw new Error('Malformed file excerpt');
    const fileKey = row.investigation_id + '|' + excerpt.file_name;
    const file = files.get(fileKey);
    if (!file || file.status !== 'accessible' || file.source_url !== row.source_url
      || url.searchParams.get('file') !== excerpt.file_name || excerpt.checkedOn !== file.checkedOn) throw new Error('File excerpt does not match the checked source');
    expectedCounts.set(fileKey, (expectedCounts.get(fileKey) ?? 0) + 1);
    if (!row.section.startsWith(`file:${file.key}:`) || !/^file:[a-f0-9]{20}:\d+$/.test(row.section) || !ids.includes(row.investigation_id)) throw new Error('Invalid file excerpt');
    const key = row.investigation_id + '|' + row.section;
    if (expected.has(key)) throw new Error('Duplicate excerpt key');
    expected.set(key, row);
  }
  for (const [key, file] of files) {
    if ((expectedCounts.get(key) ?? 0) !== file.indexedPassages) throw new Error('File manifest/excerpt count mismatch');
  }
  const existing: {id: number; investigation_id: string; section: string; content: string; source_url: string}[] = [];
  for (let offset = 0; ; offset += 1000) {
    const {data} = await db.from('chunks').select('id,investigation_id,section,content,source_url')
      .in('investigation_id', ids).like('section', 'file:%').order('id').range(offset, offset + 999).throwOnError();
    existing.push(...data);
    if (data.length < 1000) break;
  }
  const oldByKey = new Map(existing.map(row => [row.investigation_id + '|' + row.section, row]));
  const added = [];
  let updated = 0;
  for (const [key, row] of expected) {
    const old = oldByKey.get(key);
    if (!old) added.push(row);
    else if (old.content !== row.content || old.source_url !== row.source_url) {
      await db.from('chunks').update(row).eq('id', old.id).throwOnError();
      updated++;
    }
  }
  for (let i = 0; i < added.length; i += 100) await db.from('chunks').insert(added.slice(i, i + 100)).throwOnError();
  const stale = existing.filter(row => !expected.has(row.investigation_id + '|' + row.section));
  for (let i = 0; i < stale.length; i += 100) await db.from('chunks').delete().in('id', stale.slice(i, i + 100).map(row => row.id)).throwOnError();
  const {count} = await db.from('chunks').select('id', {count: 'exact', head: true}).in('investigation_id', ids).like('section', 'file:%').throwOnError();
  if (count !== expected.size) throw new Error('File index verification failed');
  console.log({indexed: count, added: added.length, updated, removedStale: stale.length,
    payloadSha256: createHash('sha256').update(JSON.stringify(passages)).digest('hex'),
    sourceTextBytes: Buffer.byteLength(JSON.stringify(passages))});
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
