import {conversationTitlesSchema, parseConversationTitles} from '../src/lib/conversationTitle';
import assert from 'node:assert/strict';
import {parseSearchPlan, studyNames} from '../src/lib/agent/plan';
import {inspectAnswerCitations, linkCitations, readNdjson} from '../src/lib/citations';

const parse = (value: unknown, message = 'Порівняй дослідження', focus: string[] = []) =>
  parseSearchPlan(JSON.stringify(value), message, focus, ['combustion-science']);

// Malformed output must still search the latest question, preserving explicit IDs and language.
for (const raw of ['invalid JSON', 'null', '[]', '42', '{"queries": [null]}']) {
  const plan = parseSearchPlan(raw, 'Що виміряли у PSI‑25?');
  assert.equal(plan.language, 'uk');
  assert.deepEqual(plan.ids, ['PSI-25']);
  assert(plan.queries.length > 0);
}
assert.deepEqual(parseSearchPlan('```json\n{"queries":["droplet extinction"]}\n```', 'Find droplets').queries, ['droplet extinction']);
assert.deepEqual(parse({queries: [' flame spread ', 'flame spread', 'oxygen']}).queries, ['flame spread', 'oxygen']);
assert.deepEqual(parse({queries: ['', '  ']}).queries, ['Порівняй дослідження']);
assert.equal(parse({domain: 'invented'}).domain, null);
assert.equal(parse({domain: 'combustion-science'}).domain, 'combustion-science');
assert.deepEqual(parse({ids: ['bass‑ii', 'BASS-II', '%', 'PSI-25) OR true', 'a_b']}).ids, ['BASS-II']);
assert.deepEqual(studyNames([' flex-2 ', 'FLEX‑2', '*', '%', 'hello\nworld']), ['FLEX-2']);
assert.deepEqual(parse({ids: ['BASS-II']}, 'Explain PSI-39', ['PSI-25']).ids, ['PSI-39', 'BASS-II']);
assert.deepEqual(parse({queries: [null, 'droplet extinction', '', 'oxygen', 'soot', 'flame']}).queries,
  ['droplet extinction', 'oxygen', 'soot']);
assert.deepEqual(parse({ids: [null, 'PSI-25']}).ids, ['PSI-25']);
const focused = parse({ids: ['PSI-1', 'PSI-2', 'PSI-3', 'PSI-4', 'PSI-5', 'PSI-6']}, 'Which is newer?',
  ['PSI-25', 'PSI-26', 'PSI-98', 'PSI-39']);
assert.deepEqual(focused.ids.slice(0, 4), ['PSI-25', 'PSI-26', 'PSI-98', 'PSI-39']);
for (const intent of ['smalltalk', 'off_topic']) {
  assert.equal(parse({intent}, 'Hello, explain PSI-25').intent, 'detail');
  assert.equal(parse({intent, mode: 'conversation'}, 'Привіт', ['PSI-25', 'PSI-26']).mode, 'conversation');
}
assert.equal(parseSearchPlan('{"mode":"context","intent":"detail"}', 'Поясни простіше', [], [], true).mode, 'context');
assert.equal(parseSearchPlan('{"mode":"context","intent":"detail"}', 'Поясни простіше').mode, 'search');
assert.deepEqual(parse({intent: 'smalltalk', queries: ['unwanted search']}, 'Hello').queries, []);
assert.equal(parse({}, 'Find droplet tests').language, 'en');

// Presentation and verification accept the same normalized citation forms.
const known = ['PSI-25', 'PUB-3', 'FILE-5000'];
for (const text of ['Дані. [PSI-25]', 'Дані. [psi‑25; pub-3]', 'Дані. [PSI-25][FILE-5000]']) {
  const inspected = inspectAnswerCitations(text, known);
  assert(inspected.valid);
  assert(inspected.ids.length);
  const linked = linkCitations(text, known.map(id => ({id, kind: 'data', title: id, url: `https://example.org/${id}`})));
  for (const id of inspected.ids) assert(linked.includes(`[${id}](<https://example.org/${id}>)`));
}
for (const text of ['Дані. [FILE-999]', '[PSI-25, FILE-unknown]', '[PSI-25; wrong]', '[PSI-25](https://example.org)',
  'https://example.org', '![plot](data:image/png;base64,x)', '<img src="x">', '[source]: /untrusted']) {
  assert.equal(inspectAnswerCitations(text, known).valid, false, text);
}
assert(inspectAnswerCitations('У наданих джерелах цього не вказано.', []).valid);
console.log('Agent checks passed: malformed plans, exact IDs, follow-ups, domains, query bounds and citation destinations.');

// UTF-8 and the terminal event may span chunks or arrive without a trailing newline.
async function checkResponseReader() {
  const encoded = new TextEncoder().encode('{"type":"delta","text":"Привіт"}\n{"type":"done"}');
  const body = new ReadableStream<Uint8Array>({start(controller) {
    for (const byte of encoded) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  }});
  const events: unknown[] = [];
  await readNdjson(body, event => events.push(event));
  assert.deepEqual(events, [{type: 'delta', text: 'Привіт'}, {type: 'done'}]);
  assert.equal(body.locked, false);
  console.log('Response reader passed: split Unicode, final event without newline and reader cleanup.');
}
checkResponseReader().catch(error => {console.error(error); process.exitCode = 1;});

async function checkPublicResearch() {
  const {addNasaEvidence, nasaIdFromQuestion, publicSearchTerms} = await import('../src/lib/agent/nasaEvidence');
  const id = '20160001341';
  assert.equal(nasaIdFromQuestion(`Read https://ntrs.nasa.gov/citations/${id}`), id);
  assert.equal(nasaIdFromQuestion(`https://ntrs.nasa.gov.example.com/citations/${id}`), undefined);
  assert.deepEqual(publicSearchTerms(['a@b.com', 'https://localhost', 'tel 0987654321', 'capillary channel flow']), ['capillary channel flow']);

  const local = {cards: [], context: 'Catalog evidence'};
  const original = globalThis.fetch;
  const requests: string[] = [];
  const report = {
    id: Number(id), title: 'Capillary channel flow', abstract: 'Public abstract.',
    downloads: [
      {draft: false, links: {fulltext: `/api/citations/${id}/downloads/../private.txt`}},
      {draft: false, links: {fulltext: `/api/citations/${id}/downloads/report.txt`}},
    ],
  };
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push(url.pathname);
      assert.equal(url.origin, 'https://ntrs.nasa.gov');
      assert.equal(init?.redirect, 'error');
      if (url.pathname.endsWith('/search')) return Response.json({results: [report]});
      if (url.pathname.endsWith('/report.txt')) return new Response(('The results describe capillary channel flow and measured conditions. ').repeat(5));
      if (url.pathname.endsWith(id)) return Response.json(report);
      throw new Error('Unexpected request');
    };
    const searched = await addNasaEvidence(local, {queries: ['capillary channel flow'], signal: AbortSignal.timeout(2000)});
    assert.equal(searched.cards[0].id, `NTRS-${id}`);
    assert.match(searched.context, /Catalog evidence/);
    assert.match(searched.context, /measured conditions/);
    assert.equal(requests.length, 2);
    requests.length = 0;
    await addNasaEvidence(local, {ids: [id], signal: AbortSignal.timeout(2000)});
    assert.deepEqual(requests, [`/api/citations/${id}`, `/api/citations/${id}/downloads/report.txt`]);
    globalThis.fetch = async () => new Response('', {status: 503});
    assert.equal(await addNasaEvidence(local, {ids: [id], signal: AbortSignal.timeout(2000)}), local);
  } finally {
    globalThis.fetch = original;
  }
  console.log('NASA checks passed: official origin, bounded public queries, full-text excerpts, citation reopening and catalog fallback.');
}
void checkPublicResearch().catch(error => { console.error(error); process.exitCode = 1; });


assert.equal(conversationTitlesSchema.safeParse({en: 'Capillary flow comparison', uk: 'Порівняння капілярних потоків'}).success, true);
for (const en of ['Broken...', 'Bad · separator', 'One' + String.fromCharCode(10) + 'Two', '<tag>', 'Too many words in a title that keeps going']) {
  assert.equal(conversationTitlesSchema.safeParse({en, uk: 'Порівняння потоків'}).success, false);
}
console.log('Title validation passed: complete, bounded bilingual names without ellipses or markup.');

const localizedTitles = {en: 'Capillary flow comparison', uk: 'Порівняння капілярних потоків'};
const titleJson = JSON.stringify(localizedTitles);
for (const encoded of [titleJson, '```json\n' + titleJson + '\n```', JSON.stringify(titleJson), titleJson.replaceAll('"', '\\"')]) {
  assert.deepEqual(parseConversationTitles(encoded), localizedTitles);
}
assert.equal(parseConversationTitles('Not JSON'), null);
assert.equal(parseConversationTitles('{"en":"Broken...","uk":"Назва"}'), null);
