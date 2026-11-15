/** Read-only NASA file audit. Binaries stay local; permanent URLs never contain S3 signatures. */
import {createClient} from '@supabase/supabase-js';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const TEXT_FORMATS = new Set(['csv', 'tsv', 'txt', 'pdf', 'xlsx', 'xls', 'dat']);
const DOWNLOAD_HOSTS = new Set(['psi.nasa.gov', 'psi-repo-prod.s3.amazonaws.com', 'psi-curation-prod.s3.amazonaws.com']);
const args = process.argv.slice(2);
const directory = resolve(args.find(arg => !arg.startsWith('--')) ?? '/tmp/igris-file-audit');
const checkedOn = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function allowedDownload(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && DOWNLOAD_HOSTS.has(url.hostname);
}

async function readBounded(response, limit) {
  if (!response.body) throw new Error('empty_body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('size_limit');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function httpStatus(status) {
  if (status === 401 || status === 403) return 'restricted';
  return status === 404 ? 'not_found' : 'server_error';
}

async function main() {
  await mkdir(join(directory, 'downloads'), {recursive: true});
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {auth: {persistSession: false}});
  const {data: investigations} = await db.from('investigations').select('id').eq('research_area', 'Combustion Science').throwOnError();
  const ids = investigations.map(inv => inv.id);
  if (!ids.length) throw new Error('No combustion investigations found');

  const selected = [];
  for (let offset = 0; ; offset += 1000) {
    const {data} = await db.from('files').select('id,investigation_id,file_name,bytes,kind,restricted')
      .in('investigation_id', ids).order('kind', {ascending: false}).order('id').range(offset, offset + 999).throwOnError();
    selected.push(...data);
    if (data.length < 1000) break;
  }
  await writeFile(join(directory, 'inventory.json'), JSON.stringify(selected));
  const metadata = new Map();
  for (const id of ids) {
    const response = await fetch(`https://psi.nasa.gov/geode-py/ws/repo/investigations/${id}`, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`NASA metadata ${response.status} for ${id}`);
    const document = await response.json();
    await writeFile(join(directory, id + '.json'), JSON.stringify(document));
    metadata.set(id, document._source ?? document);
  }

  const fileKey = file => file.investigation_id + '|' + file.file_name;
  const uniqueByKey = new Map();
  for (const file of selected) if (!uniqueByKey.has(fileKey(file))) uniqueByKey.set(fileKey(file), file);
  const files = [...uniqueByKey.values()].sort((a, b) =>
    Number(b.kind === 'experimental_table') - Number(a.kind === 'experimental_table') || (a.bytes ?? Infinity) - (b.bytes ?? Infinity),
  );
  const originalFile = file => {
    const document = metadata.get(file.investigation_id);
    return [...(document?.experimentalTable ?? []), ...(document?.added ?? [])]
      .find(item => (item.file_name ?? item.fileName) === file.file_name);
  };
  const prior = args.includes('--resume')
    ? await readFile(join(directory, 'access.json'), 'utf8').then(JSON.parse, () => []) : [];
  const results = prior.filter(row => {
    const current = uniqueByKey.get(fileKey(row));
    if (!current || row.status !== 'accessible' || row.checkedOn !== checkedOn) return false;
    const original = originalFile(current);
    return original && !current.restricted && !original.restricted && !metadata.get(current.investigation_id).filesDisabled
      && (original.version ?? null) === row.version;
  });
  const done = new Set(results.map(fileKey));
  let reservedBytes = results.reduce((sum, row) => sum + (row.downloadedBytes ?? 0), 0);

  async function check(file) {
    const document = metadata.get(file.investigation_id);
    const original = originalFile(file);
    const key = createHash('sha256').update(fileKey(file)).digest('hex').slice(0, 20);
    const row = {key, investigation_id: file.investigation_id, file_name: file.file_name,
      kind: file.kind, bytes: file.bytes, checkedOn, status: 'unverified', attempts: [], indexedPassages: 0};
    if (!original) return {...row, status: 'not_in_current_metadata'};
    if (file.restricted || original.restricted || document.filesDisabled) return {...row, status: 'restricted'};
    const url = new URL(`https://psi.nasa.gov/geode-py/ws/studies/${file.investigation_id}/download`);
    url.searchParams.set('file', file.file_name);
    if (original.version) url.searchParams.set('version', original.version);
    row.source_url = url.href;
    row.version = original.version ?? null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resolver = new URL(url);
        resolver.searchParams.set('redirect', 'false');
        const response = await fetch(resolver, {signal: AbortSignal.timeout(12000), redirect: 'error'});
        row.attempts.push({step: 'resolver', status: response.status});
        if (!response.ok) {
          row.status = httpStatus(response.status);
          await response.body?.cancel();
          if (response.status >= 500 || response.status === 404) continue;
          return row;
        }
        let target;
        try {
          target = new URL((await readBounded(response, 16384)).toString().trim().replace(/^"|"$/g, ''));
        } catch {
          return {...row, status: 'invalid_download_response'};
        }
        if (!allowedDownload(target)) return {...row, status: 'unsupported_download_host', host: target.hostname};
        const probe = await fetch(target, {headers: {Range: 'bytes=0-255'}, signal: AbortSignal.timeout(12000), redirect: 'error'});
        row.attempts.push({step: 'file_probe', status: probe.status});
        row.contentType = probe.headers.get('content-type');
        if (!probe.ok) {
          await probe.body?.cancel();
          row.status = httpStatus(probe.status);
          if (probe.status >= 500 || probe.status === 404) continue;
          return row;
        }
        const reader = probe.body?.getReader();
        let part;
        try { part = await reader?.read(); } finally { await reader?.cancel(); }
        if (!part?.value?.length) return {...row, status: 'empty_file'};
        const prefix = Buffer.from(part.value).toString().slice(0, 100);
        if (/text\/html/.test(row.contentType ?? '') || /<!doctype html|<html/i.test(prefix)) return {...row, status: 'html_instead_of_file'};
        row.status = 'accessible';

        const extension = file.file_name.toLowerCase().split('.').pop();
        const eligible = TEXT_FORMATS.has(extension) && file.bytes > 0 && file.bytes <= MAX_FILE_BYTES;
        if (eligible && reservedBytes + file.bytes <= MAX_TOTAL_BYTES) {
          // Reserve before awaiting: concurrent workers cannot exceed the total byte budget.
          reservedBytes += file.bytes;
          try {
            const body = await fetch(target, {signal: AbortSignal.timeout(25000), redirect: 'error'});
            if (!body.ok) { await body.body?.cancel(); throw new Error('HTTP ' + body.status); }
            const bytes = await readBounded(body, Math.min(file.bytes, MAX_FILE_BYTES));
            row.localFile = join(directory, 'downloads', key + '.' + extension);
            await writeFile(row.localFile, bytes);
            row.downloadedBytes = bytes.length;
            row.sha256 = createHash('sha256').update(bytes).digest('hex');
          } catch (error) {
            row.extractionStatus = 'download_failed';
            row.extractionError = error.name === 'TimeoutError' ? 'timeout' : error.message.slice(0, 60);
          }
        }
        return row;
      } catch (error) {
        row.attempts.push({step: 'request', error: error.name});
        row.status = error.name === 'TimeoutError' ? 'timeout' : 'network_error';
      }
    }
    return row;
  }

  let next = 0;
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < files.length) {
      const file = files[next++];
      if (done.has(fileKey(file))) continue;
      results.push(await check(file));
      if (results.length % 30 === 0) console.log('Checked', results.length, 'of', files.length);
    }
  }));
  const temporary = join(directory, 'access.tmp.json');
  await writeFile(temporary, JSON.stringify(results, null, 2));
  await rename(temporary, join(directory, 'access.json'));
  console.log('Finished', results.length, 'unique files representing', selected.length, 'rows;',
    'downloaded', results.filter(row => row.localFile).length, 'files',
    results.reduce((sum, row) => sum + (row.downloadedBytes ?? 0), 0), 'bytes');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
