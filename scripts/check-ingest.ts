import assert from 'node:assert/strict';
import {mergePublications, publicationKey} from './lib/publications';

const fresh = {source: 'psi', title: 'Example study', doi: 'broken-doi', url: null, abstract: null, year: 0, authors: null};
const audited = {title: 'Example study (2025)', doi: '10.1234/repaired', url: 'https://doi.org/10.1234/repaired', abstract: 'Verified source text.', year: 2025, authors: 'NASA author'};
const merged = mergePublications([fresh, fresh], [audited]);
assert.equal(merged.length, 1, 'Duplicate publisher rows should not inflate catalog counts');
assert.equal(merged[0].doi, audited.doi);
assert.equal(merged[0].url, audited.url);
assert.equal(merged[0].year, 2025, 'Reimport must retain the audited publication year');
assert.equal(merged[0].authors, audited.authors);
assert.equal(merged[0].abstract, audited.abstract);
assert.equal(mergePublications([{...fresh, title: 'No accessible evidence'}], [audited]).length, 0);
assert.equal(mergePublications([{...fresh, abstract: 'New official text'}], [audited])[0].abstract, 'New official text');
assert.notEqual(publicationKey(fresh), publicationKey({...fresh, source: 'ntrs'}));
console.log('Verified publication repairs, cached abstracts, source identity and duplicate handling on reimport.');
