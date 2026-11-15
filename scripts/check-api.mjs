/** Production-server smoke tests with isolated database/model fixtures; no external writes or credits. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {once} from 'node:events';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [passages, manifest] = await Promise.all([
  readJson('../data/psi-file-passages.json'), readJson('../src/lib/psi-file-status.json'),
]);
const investigations = [
  {id: 'PSI-25', hardware: ['DEvice for the study of Critical LIquids and Crystallization (DECLIC)'], acronym: 'BASS-II', title: 'Burning and Suppression of Solids - II'},
  {id: 'PSI-26', hardware: ['Device for the study of Crtical Liquids and Crystallization (DECLIC)'], acronym: 'BASS', title: 'Burning and Suppression of Solids'},
  {id: 'PSI-98', acronym: 'SAFFIRE-I', title: 'Spacecraft Fire Safety Experiment-I'},
].map(row => ({domain_id: 'combustion-science', sub_research_area: 'Spacecraft Fire Safety',
  start_date: null, end_date: null, hardware: [], platform: 'ISS', description: null,
  objective: 'Study combustion in microgravity.', hypothesis: null, approach: null, impacts: null,
  file_count: 60, table_count: 1, publication_count: 0, ...row,
  source_url: `https://psi.nasa.gov/physci/repo/data/investigations/${row.id}`}));
const chunks = passages.map((row, index) => ({id: 5000 + index, ...row}));
const files = manifest.records.map(row => ({...row, restricted: false, category: null}));
const tables = {investigations, chunks, files, publications: [], investigation_parameters: [],
  domains: [{id: 'combustion-science', name: 'Combustion Science', enabled: true}]};
let scenario = 'supported';
let reviews = 0;
let modelCalls = 0;
const comparisons = new Map();
let searches = 0;
let usageCount = 0;

function filterRows(rows, params) {
  return rows.filter(row => [...params].every(([key, value]) => {
    if (['select', 'order', 'limit', 'offset'].includes(key)) return true;
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4);
    if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
    if (value.startsWith('like.')) return String(row[key]).startsWith(value.slice(5).replace(/%$/, ''));
    if (value.startsWith('ilike.')) return String(row[key]).toLowerCase() === value.slice(6).toLowerCase();
    return true;
  })).slice(0, Number(params.get('limit') ?? 2000));
}

const fixture = createServer(async (req, res) => {
  const respond = (body, status = 200) => {
    res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(body));
  };
  try {
    const url = new URL(req.url, 'http://fixture');
    if (url.pathname === '/v1/chat/completions') {
      modelCalls++;
      const parts = []; for await (const part of req) parts.push(part);
      const body = JSON.parse(Buffer.concat(parts));
      assert.equal(body.model, 'clarke-1.0');
      assert.equal(body.reasoning_effort, 'low');
      const system = body.messages[0].content;
      const envelope = JSON.parse(body.messages.at(-1).content);
      assert.equal(typeof envelope.task, 'string');
      const payload = envelope.input;
      const reply = text => respond({choices: [{message: {content: text}}], usage: {prompt_tokens: 10, completion_tokens: 10}});
      if (system.includes('Create concise sidebar titles')) return reply(JSON.stringify({en: 'Capillary flow comparison', uk: 'Порівняння капілярних потоків'}));
      if (system.includes('plan database searches')) {
        if (scenario === 'overview' || scenario === 'overview-repair') return reply(JSON.stringify({mode: 'search', needsFiles: false, language: 'uk', intent: 'detail', queries: ['solid fuel flame'], ids: ['PSI-25']}));
        if (scenario === 'greeting') return reply(JSON.stringify({mode: 'conversation', language: 'uk', intent: 'smalltalk', queries: [], ids: []}));
        if (scenario === 'context') return reply(JSON.stringify({mode: 'context', language: 'uk', intent: 'detail', queries: [], ids: []}));
        if (scenario === 'planner-malformed') return reply('invalid JSON');
        if (scenario === 'planner-smalltalk') return reply(JSON.stringify({intent: 'smalltalk', queries: [], ids: []}));
        return reply(JSON.stringify({language: 'uk', intent: 'compare', queries: ['solid fuel flame spread'], ids: ['PSI-25', 'PSI-26'], domain: 'combustion-science'}));
      }
      if (system.includes('review a draft')) {
        assert.notEqual(scenario, 'greeting', 'Conversation must not enter scientific review');
        reviews++;
        assert(payload.evidence.includes('20210011385'));
        if (scenario !== 'overview-repair') assert.match(payload.draft, /FILE-\d+/);
        if (scenario === 'overview-repair') return reply(JSON.stringify({verdict: 'revised', answer: 'Виправлена відповідь. [PSI-25]'}));
        if (scenario === 'revised') return reply(JSON.stringify({verdict: 'revised', answer: `Уточнена відповідь. [${payload.draft.match(/FILE-\d+/)[0]}]`}));
        return reply(scenario === 'malformed' ? 'invalid JSON' : JSON.stringify({verdict: scenario === 'unsupported' ? 'unsupported' : 'supported'}));
      }
      const conversation = system.includes('conversational assistant');
      const fileId = payload.evidence?.match(/\[(FILE-\d+)\] extracted file excerpt for PSI-25/)?.[1];
      if (!conversation && !scenario.startsWith('overview')) assert(fileId, 'Exact BASS-II file evidence must survive broad retrieval');
      const citation = scenario === 'overview-repair' ? 'PSI-999999' : scenario === 'overview' ? 'PSI-25' : scenario === 'unknown' ? 'FILE-999999999' : fileId;
      const text = conversation ? `Відповідь моделі на: ${payload.question}` : scenario === 'link' ? `Дані. [Untrusted source](https://example.org) [${citation}]`
        : scenario === 'broken-citation' ? `Дані. [${citation}, FILE-unknown]` : `Таблиця містить дані BASS-II. [${citation}]`;
      res.writeHead(200, {'content-type': 'text/event-stream'});
      if (scenario === 'stalled') {
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 100);
        res.on('close', () => clearInterval(heartbeat));
        return;
      }
      res.write('data: ' + JSON.stringify({choices: [{delta: {content: text}}]}) + '\n\n');
      const finishReason = scenario === 'truncated' ? 'length' : scenario === 'filtered' ? 'content_filter'
        : scenario === 'unfinished' ? null : 'stop';
      res.write('data: ' + JSON.stringify({choices: [{delta: {}, finish_reason: finishReason}]}) + '\n\n');
      res.end('data: [DONE]\n\n');
      return;
    }
    assert(url.pathname.startsWith('/rest/v1/'), 'Unexpected fixture endpoint');
    const table = url.pathname.slice('/rest/v1/'.length);
    if (table === 'rpc/claim_comparison' || table === 'comparison_cache' && req.method === 'PATCH') {
      const parts = [];
      for await (const part of req) parts.push(part);
      const body = JSON.parse(Buffer.concat(parts));
      if (table === 'rpc/claim_comparison') {
        const existing = comparisons.get(body.p_key);
        if (existing?.answer || existing?.active) return respond(false);
        comparisons.set(body.p_key, {answer: null, leaseId: body.p_lease, active: true});
        return respond(true);
      }
      const key = url.searchParams.get('cache_key').slice(3);
      const record = comparisons.get(key);
      assert.equal(record.leaseId, url.searchParams.get('lease_id').slice(3));
      comparisons.set(key, {...record, active: false, answer: body.answer, source_cards: body.source_cards});
      return respond(null);
    }
    if (table === 'comparison_cache') {
      const record = comparisons.get(url.searchParams.get('cache_key').slice(3));
      return respond(record ? [{answer: record.answer, source_cards: record.source_cards}] : []);
    }
    if (table === 'visitors' || table === 'usage_events') {
      res.writeHead(req.method === 'HEAD' ? 200 : 201, {'Content-Range': `*/${usageCount}`}); return res.end();
    }
    if (table.startsWith('rpc/search_')) searches++;
    if (table === 'rpc/search_investigations') return respond(investigations.map(row => ({id: row.id, rank: 1})));
    if (table === 'rpc/search_chunks') return respond(chunks.slice(0, 12));
    if (table === 'rpc/search_study_chunks') {
      const parts = []; for await (const part of req) parts.push(part);
      const {investigation_ids} = JSON.parse(Buffer.concat(parts));
      return respond(chunks.filter(row => investigation_ids.includes(row.investigation_id)).slice(0, 12));
    }
    assert(['GET', 'HEAD'].includes(req.method), 'Research tables must stay read-only');
    assert(table in tables, `Unknown fixture table: ${table}`);
    const rows = filterRows(tables[table], url.searchParams);
    return respond(req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  } catch (error) { console.error(error); respond({error: error.message}, 500); }
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const appPort = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const base = `http://127.0.0.1:${appPort}`;
let appLog = '';
const appEnv = {
  PUBLIC_RESEARCH_ENABLED: 'false',...process.env, SUPABASE_URL: fixtureUrl, SUPABASE_SECRET_KEY: 'fixture-only',
  RADIUM_BASE_URL: fixtureUrl + '/v1', RADIUM_MODEL: 'clarke-1.0', RADIUM_REASONING_EFFORT: 'low',
  RADIUM_API_KEY: 'fixture-only', RADIUM_API_KEY_BACKUP: '', LIMITS_ENABLED: 'false', LIMIT_MODEL_TIMEOUT_MS: '1500', LIMIT_REQUEST_TIMEOUT_MS: '5000'};
const startApp = () => spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(appPort)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: appEnv,
});
let app = startApp();
app.stdout.on('data', data => { appLog += data; });
app.stderr.on('data', data => { appLog += data; });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (app.exitCode !== null) throw new Error(appLog);
    if (await fetch(base + '/catalog').then(response => response.ok, () => false)) { ready = true; break; }
    await delay(100);
  }
  assert(ready, 'Production server did not start; run npm run build first');
  const call = async (path, chat = {message: 'Порівняй BASS-II і BASS', focus: ['PSI-25', 'PSI-26']}) => {
    const response = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify(path.endsWith('compare') ? {ids: ['PSI-25', 'PSI-26'], lang: 'uk'}
        : chat)});
    assert.equal(response.status, 200);
    return (await response.text()).trim().split('\n').map(JSON.parse);
  };
  for (const route of ['/api/chat', '/api/compare']) {
    const events = await call(route);
    assert(events.some(event => event.type === 'delta' && /\[FILE-\d+\]/.test(event.text)));
    assert(events.find(event => event.type === 'sources').cards.some(card => card.url === 'https://ntrs.nasa.gov/citations/20210011385'));
    assert.equal(events.at(-1).type, 'done');
    assert(events.some(event => event.type === 'step' && event.id === 'verify' && event.status === 'complete'));
  }
  const titleResponse = await fetch(base + '/api/conversation-title', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({surface: 'comparison', studies: ['PWM', 'PSI-66'], turns: [{role: 'assistant', content: 'Compare selected studies.'}]})});
  assert.equal(titleResponse.status, 200);
  assert.deepEqual(await titleResponse.json(), {en: 'Capillary flow comparison', uk: 'Порівняння капілярних потоків'});
  const callsAfterTitle = modelCalls;
  const invalidTitle = await fetch(base + '/api/conversation-title', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({surface: 'chat', studies: [], turns: []})});
  assert.equal(invalidTitle.status, 400);
  assert.equal(modelCalls, callsAfterTitle, 'Invalid title input must not call the model');
  const callsAfterComparison = modelCalls;
  const replay = await fetch(base + '/api/compare', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ids: ['PSI-26', 'PSI-25'], lang: 'uk'})});
  assert.equal(replay.headers.get('x-comparison-cache'), 'hit');
  assert.match(await replay.text(), /FILE-\d+/);
  assert.equal(modelCalls, callsAfterComparison, 'Repeated comparison must not call the model');
  const sharedBeforeRegeneration = JSON.stringify([...comparisons]);
  const regenerated = await fetch(base + '/api/compare', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ids: ['PSI-25', 'PSI-26'], lang: 'uk', regenerate: true})});
  const regeneratedEvents = (await regenerated.text()).trim().split('\n').map(JSON.parse);
  assert.equal(regenerated.headers.get('x-comparison-cache'), null);
  assert.equal(regeneratedEvents.at(-1).type, 'done');
  assert(modelCalls > callsAfterComparison, 'Explicit regeneration must call the model');
  assert.equal(JSON.stringify([...comparisons]), sharedBeforeRegeneration, 'A personal regeneration preserves the shared cached comparison');
  scenario = 'greeting';
  const greeting = await call('/api/chat', {message: 'Привіт, що ти вмієш?'});
  assert(greeting.some(event => event.type === 'delta' && event.text.includes('Привіт, що ти вмієш?')));
  assert(!greeting.some(event => event.type === 'sources' || event.id === 'verify'));
  assert(!greeting.some(event => event.id === 'plan' || event.id === 'search'));
  assert.equal(greeting.at(-1).type, 'done');
  assert.deepEqual(greeting.at(-1), {type: 'done'}, 'Do not publish a remaining-message countdown');
  for (scenario of ['planner-malformed', 'planner-smalltalk']) {
    const events = await call('/api/chat', {message: 'Що виміряли у PSI‑25?'});
    assert(events.some(event => event.type === 'delta'), 'Explicit PSI IDs must survive planner failures');
    assert.equal(events.at(-1).type, 'done');
  }
  const reviewsBeforeRejections = reviews;
  for (scenario of ['unsupported', 'unknown', 'malformed', 'link', 'broken-citation', 'truncated', 'filtered', 'unfinished']) {
    const events = await call('/api/chat');
    assert(!events.some(event => event.type === 'delta'));
    assert.equal(events.at(-1).code, scenario === 'malformed' ? 'model_unavailable'
      : ['truncated', 'filtered', 'unfinished'].includes(scenario) ? 'answer_incomplete' : 'answer_unverified');
  }
  assert.equal(reviews - reviewsBeforeRejections, 5, 'Invalid citations may be repaired, but incomplete drafts must stop before review');
  scenario = 'revised';
  const revised = await call('/api/chat');
  assert(revised.some(event => event.type === 'delta' && event.text.startsWith('Уточнена відповідь')));
  scenario = 'context';
  const beforeSearches = searches;
  const context = await call('/api/chat', {message: 'Поясни попередні результати простіше', sourceIds: ['PSI-25', 'FILE-5000']});
  assert.equal(searches, beforeSearches, 'An existing-source follow-up must not run a new text search');
  assert(context.some(event => event.id === 'context'));
  assert(!context.some(event => event.id === 'verify'), 'Reusing evidence must not repeat the full research review');
  assert.equal(context.at(-1).type, 'done');
  scenario = 'overview';
  const reviewsBeforeOverview = reviews;
  const overview = await call('/api/chat', {message: 'Поясни BASS-II'});
  assert(overview.some(event => event.type === 'delta'));
  assert.equal(reviews, reviewsBeforeOverview, 'An ordinary overview does not need a second model reviewer');
  scenario = 'overview-repair';
  const repair = await call('/api/chat', {message: 'Поясни BASS-II'});
  assert(!repair.some(event => event.type === 'delta' && event.text.includes('PSI-999999')));
  assert(repair.some(event => event.type === 'replace' && event.text === 'Виправлена відповідь. [PSI-25]'));
  assert.equal(repair.at(-1).type, 'done');
  scenario = 'stalled';
  const stalled = await call('/api/chat');
  assert(!stalled.some(event => event.type === 'delta'));
  assert.equal(stalled.at(-1).code, 'model_unavailable', 'An idle stream must time out even while heartbeats arrive');
  const detail = await fetch(base + '/api/investigations/PSI-25').then(response => response.json());
  assert.equal(detail.references.find(source => source.id === 'NTRS-20210011385').relation, 'study');
  const table = detail.files.find(file => file.file_name.endsWith('BASS-II.csv'));
  assert.equal(table.access_status, 'accessible'); assert.equal(table.indexed_passages, 15);
  assert.equal(new Set(detail.files.map(file => file.file_name)).size, detail.files.length);
  const catalog = await fetch(base + '/api/investigations?q=BASS-II').then(response => response.json());
  assert(catalog.rows.find(row => row.id === 'PSI-25').reference_count > 0);
  const analytics = await fetch(base + '/api/analytics').then(response => response.json());
  const declic = analytics.byHardware.filter(row => row.label.includes('DECLIC'));
  assert.deepEqual(declic.map(row => row.count), [2], 'Hardware spelling variants must share one analytics category');
  assert.equal('conditions' in analytics, false, 'Independent study parameters are not paired test measurements');
  const byInstrument = await fetch(base + '/api/investigations?hardware=' + encodeURIComponent(declic[0].label))
    .then(response => response.json());
  assert.equal(byInstrument.total, 2, 'Analytics links and catalog filters must count the same category');

  scenario = 'unsupported';
  const fallback = await fetch(base + '/api/compare', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ids: ['PSI-25', 'PSI-26'], lang: 'en'})});
  const fallbackEvents = (await fallback.text()).trim().split('\n').map(JSON.parse);
  assert(fallbackEvents.some(event => event.type === 'delta' && event.text.includes('could not be verified') && event.text.includes('[PSI-26]')));
  assert.equal(fallbackEvents.at(-1).type, 'done');
  usageCount = 99999;
  scenario = 'greeting';
  assert.equal((await call('/api/chat', {message: 'Привіт'})).at(-1).type, 'done', 'Disabled limits must not reject a high usage count');
  const exited = once(app, 'exit');
  app.kill('SIGTERM');
  await exited;
  appEnv.LIMITS_ENABLED = 'true';
  app = startApp();
  app.stdout.on('data', data => { appLog += data; });
  app.stderr.on('data', data => { appLog += data; });
  for (let i = 0; i < 60; i++) {
    if (await fetch(base + '/api/health').then(r => r.ok, () => false)) break;
    await delay(100);
  }
  const limited = await fetch(base + '/api/chat', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({message: 'Привіт'})});
  assert.equal(limited.status, 429, 'Enabled limits must still protect production requests');
  const limitedTitle = await fetch(base + '/api/conversation-title', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({surface: 'chat', studies: [], turns: [{role: 'user', content: 'Hello'}]})});
  assert.equal(limitedTitle.status, 429, 'Metadata generation must respect enabled quotas');
  const cachedUnderLimit = await fetch(base + '/api/compare', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ids: ['PSI-25', 'PSI-26'], lang: 'uk'})});
  assert.equal(cachedUnderLimit.headers.get('x-comparison-cache'), 'hit', 'Saved comparisons survive server restarts and exhausted quotas');
  await cachedUnderLimit.text();
  const limitedRegeneration = await fetch(base + '/api/compare', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ids: ['PSI-25', 'PSI-26'], lang: 'uk', regenerate: true})});
  assert.equal(limitedRegeneration.status, 429, 'Explicit regeneration must respect enabled quotas');
  console.log('API smoke passed: chat, comparison, file citations, rejection paths, source associations and catalog metadata.');
} catch (error) { console.error(appLog); throw error; }
finally {
  app.kill('SIGTERM');
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}
