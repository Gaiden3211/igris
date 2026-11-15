/** Refresh source abstracts from the official NASA API. No credentials required. */
import {rename, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {challengeSourceLink, challengeSources, challengeSourcesReviewedOn} from '../src/lib/agent/challenge-sources';

type Snapshot = {url: string; checkedOn: string; text: string; coverage: 'abstract' | 'reviewed_summary'};

async function readNasaRecord(id: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`https://ntrs.nasa.gov/api/citations/${id}`, {
        signal: AbortSignal.timeout(15000), headers: {accept: 'application/json'},
      });
      if (!response.ok) throw new Error(`NTRS-${id}: NASA HTTP ${response.status}`);
      const document = await response.json();
      if (String(document.id) !== id || typeof document.title !== 'string') {
        throw new Error(`NTRS-${id}: invalid NASA record`);
      }
      return document;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
}

async function main() {
  const output: Record<string, Snapshot> = {};
  for (const source of challengeSources) {
    const link = challengeSourceLink(source);
    let text: string = source.summary;
    let coverage: Snapshot['coverage'] = 'reviewed_summary';
    if (source.ntrsId) {
      const document = await readNasaRecord(source.ntrsId);
      if (typeof document.abstract === 'string' && document.abstract.trim()) {
        text = document.abstract.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        coverage = 'abstract';
      }
    }
    output[link.id] = {url: link.url, checkedOn: challengeSourcesReviewedOn, text, coverage};
    console.log(`${link.id}: ${coverage}, ${text.length} characters`);
  }
  const target = resolve(__dirname, '../src/lib/agent/reference-content.json');
  const temporary = target + '.tmp';
  await writeFile(temporary, JSON.stringify(output, null, 2) + '\n');
  await rename(temporary, target);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
