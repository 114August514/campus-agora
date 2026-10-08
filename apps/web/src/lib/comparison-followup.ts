import type { ComparisonPerspective } from "./advisor-comparison";
import type { Advisor } from "./advisors";
import type { ExplorationTopic, SourceSnapshot } from "./exploration-store";

const searchTerms: Record<ComparisonPerspective, string> = {
  research: "近期研究 论文",
  graduate: "研究生招生 PhD admission",
  "short-term": "本科科研 RA visiting students",
};

/** Start with public candidate fields; private topic notes are never query input. */
export function getFollowupQuery(
  advisor: Advisor,
  perspective: ComparisonPerspective,
): string {
  return `${advisor.name} ${advisor.institution} ${searchTerms[perspective]}`;
}

function snapshotKey(source: SourceSnapshot): string {
  // Use the store's capture identity, rather than treating one URL as one reading.
  return JSON.stringify([
    source.url,
    source.collectedAt,
    source.content,
    source.query,
    source.collection && [
      source.collection.method,
      source.collection.contentKind,
      source.collection.readStatus,
      source.collection.scope,
      source.collection.batchId,
    ],
  ]);
}

export function getSupplementalSources(
  advisor: Advisor,
  topic?: ExplorationTopic,
): SourceSnapshot[] {
  const record = topic?.candidates.find(
    (entry) => entry.candidate.candidateId === advisor.candidateId,
  );
  if (!record) return [];
  const originalCaptures = new Set(advisor.sources.map(snapshotKey));
  return record.candidate.sources.filter(
    (source) => !originalCaptures.has(snapshotKey(source)),
  );
}
