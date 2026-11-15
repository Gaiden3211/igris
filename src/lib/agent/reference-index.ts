import {challengeSources, challengeSourceLink} from './challenge-sources';
import {associationsForSource} from './source-links';
import sourceContent from './reference-content.json';

/** Bounded saved evidence; no remote fetching or inferred experiment attribution at query time. */
export function referenceChunksForInvestigation(investigationId: string) {
  return challengeSources.flatMap(source => {
    const link = challengeSourceLink(source);
    const association = associationsForSource(link.id).find(item => item.investigationId === investigationId);
    const snapshot = (sourceContent as Record<string, {url: string; text: string; coverage: string}>)[link.id];
    if (!association || snapshot?.url !== link.url || !snapshot.text.trim()) return [];
    return [{
      investigation_id: investigationId,
      section: `reference:${link.id}`,
      source_url: link.url,
      content: `${source.title} (${source.year}). Evidence type: ${source.type}. Coverage: ${snapshot.coverage}. Catalog relationship: ${association.relation}. ${association.reason}\n${snapshot.text}`,
    }];
  });
}

/** Only exact study links with an official abstract become catalog publications. */
export function directReferencePublicationsForInvestigation(investigationId: string) {
  return challengeSources.flatMap(source => {
    if (!source.ntrsId) return [];
    const link = challengeSourceLink(source);
    if (!associationsForSource(link.id).some(item => item.investigationId === investigationId && item.relation === 'study')) return [];
    const snapshot = (sourceContent as Record<string, {url: string; text: string; coverage: string}>)[link.id];
    if (snapshot?.url !== link.url || snapshot.coverage !== 'abstract' || !snapshot.text.trim()) return [];
    return [{
      investigation_id: investigationId, source: 'ntrs' as const, external_id: source.ntrsId,
      title: source.title, authors: null, year: source.year, doi: null, url: link.url, abstract: snapshot.text,
    }];
  });
}
