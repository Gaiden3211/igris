import assert from 'node:assert/strict';
import {challengeSources, challengeSourceLink, findChallengeSources, sourcesForInvestigation} from '../src/lib/agent/challenge-sources';
import {sourceAssociations, associationsForSource} from '../src/lib/agent/source-links';
import {directReferencePublicationsForInvestigation, referenceChunksForInvestigation} from '../src/lib/agent/reference-index';
import snapshots from '../src/lib/agent/reference-content.json';

const sourceIds = new Set(challengeSources.map(source => challengeSourceLink(source).id));
assert.equal(sourceIds.size, challengeSources.length, 'Source IDs must be unique');
for (const id of Object.keys(sourceAssociations)) assert(sourceIds.has(id), `Association points to unknown source ${id}`);
for (const source of challengeSources) {
  const link = challengeSourceLink(source);
  assert(sourceAssociations[link.id], `Source needs reviewed association or an explicit catalog gap: ${link.id}`);
  const snapshot = (snapshots as Record<string, {url: string; text: string}>)[link.id];
  assert.equal(snapshot?.url, link.url, `Snapshot URL mismatch: ${link.id}`);
  assert(snapshot?.text.trim(), `Missing saved source text: ${link.id}`);
  const links = associationsForSource(link.id);
  assert.equal(new Set(links.map(item => item.investigationId)).size, links.length, `Duplicate/contradictory association: ${link.id}`);
  for (const item of links) {
    assert.match(item.investigationId, /^PSI-\d+$/);
    const chunk = referenceChunksForInvestigation(item.investigationId).find(row => row.source_url === link.url);
    assert(chunk?.content.includes(`Catalog relationship: ${item.relation}.`), 'Index must preserve the relationship qualifier');
  }
}
// Exact BASS-II evidence must outrank newer but different experiments, even without search keywords.
assert.equal(challengeSourceLink(findChallengeSources([], ['PSI-25'])[0]).id, 'NTRS-20210011385');
assert.equal(challengeSourceLink(findChallengeSources([], ['PSI-39'])[0]).id, 'NTRS-20260002014');
assert.equal(challengeSourceLink(findChallengeSources([], ['NTRS-20080012612'])[0]).id, 'NTRS-20080012612');
const comparedSources = findChallengeSources(['solid fuel flame spread radiation'], ['PSI-25', 'PSI-39']);
for (const investigationId of ['PSI-25', 'PSI-39']) {
  assert(comparedSources.some(source => associationsForSource(challengeSourceLink(source).id)
    .some(link => link.investigationId === investigationId && link.relation === 'study')),
  `A selected study must retain its own reviewed evidence: ${investigationId}`);
}
assert.equal(sourcesForInvestigation('PSI-98').find(source => source.id === 'NTRS-20260001992')?.relation, 'related');
assert.equal(directReferencePublicationsForInvestigation('PSI-98').length, 0, 'Saffire VI must not become a Saffire I publication');
assert.equal(directReferencePublicationsForInvestigation('PSI-26').length, 0, 'BASS-II must not become a BASS publication');
assert(directReferencePublicationsForInvestigation('PSI-25').some(paper => paper.external_id === '20210011385'));
assert(directReferencePublicationsForInvestigation('PSI-39').some(paper => paper.external_id === '20260002014'));
assert.equal(associationsForSource('NTRS-20260000641').length, 0, 'Do not force centrifuge CFD into an unrelated PSI study');
assert.equal(referenceChunksForInvestigation('PSI-999999').length, 0);
console.log(`Verified ${sourceIds.size} source snapshots, relationship qualifiers, direct publication boundaries and retrieval priority.`);
