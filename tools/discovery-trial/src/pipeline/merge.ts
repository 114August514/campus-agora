// Merge extracted candidates with existing public objects. Conservative by design:
// uncertain identity becomes "needs-review" instead of an automatic merge.
import type {
  Evidence,
  ExtractedCandidate,
  MergeOutcome,
  PublicCandidate,
  Route,
} from "../types.ts";
import {
  affiliationMatches,
  nameKey,
  normalizeText,
  normalizeUrl,
} from "./normalize.ts";

function evidenceKey(e: Evidence): string {
  return `${normalizeUrl(e.sourceUrl)}|${normalizeText(e.quote)}`;
}

function dedupeEvidence(list: Evidence[]): Evidence[] {
  const seen = new Map<string, Evidence>();
  for (const e of list) {
    const key = evidenceKey(e);
    const prev = seen.get(key);
    // Prefer a live read over a cached snapshot for the same quote.
    if (!prev || (prev.origin !== "live" && e.origin === "live")) seen.set(key, e);
  }
  return [...seen.values()];
}

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

function combine(a: ExtractedCandidate, b: ExtractedCandidate): ExtractedCandidate {
  const routes = new Map<string, Route>();
  for (const r of [...a.routes, ...b.routes]) {
    const key = `${r.kind}|${r.status}|${normalizeText(r.description)}`;
    const prev = routes.get(key);
    routes.set(
      key,
      prev
        ? { ...prev, evidence: dedupeEvidence([...prev.evidence, ...r.evidence]) }
        : r,
    );
  }
  return {
    name: a.name,
    affiliation: a.affiliation ?? b.affiliation,
    homepage: a.homepage ?? b.homepage,
    researchTopics: uniq([...a.researchTopics, ...b.researchTopics]),
    relationToQuestion: a.relationToQuestion || b.relationToQuestion,
    routes: [...routes.values()],
    evidence: dedupeEvidence([...a.evidence, ...b.evidence]),
    unknowns: uniq([...a.unknowns, ...b.unknowns]),
  };
}

function identityKey(c: ExtractedCandidate): string {
  return `${nameKey(c.name)}|${c.affiliation ? normalizeText(c.affiliation) : ""}`;
}

/** Collapse repeated sightings within one run (same name + same affiliation). */
export function groupCandidates(found: ExtractedCandidate[]): ExtractedCandidate[] {
  const groups = new Map<string, ExtractedCandidate>();
  for (const c of found) {
    const key = identityKey(c);
    const prev = groups.get(key);
    groups.set(
      key,
      prev ? combine(prev, c) : { ...c, evidence: dedupeEvidence(c.evidence) },
    );
  }
  return [...groups.values()];
}

function sourceUrls(c: ExtractedCandidate): string[] {
  return uniq(
    [...c.evidence, ...c.routes.flatMap((r) => r.evidence)].map((e) => e.sourceUrl),
  );
}

export function mergeWithSpecimens(
  found: ExtractedCandidate[],
  specimens: PublicCandidate[],
): MergeOutcome[] {
  return groupCandidates(found).map((candidate): MergeOutcome => {
    const key = nameKey(candidate.name);
    const homepage = candidate.homepage ? normalizeUrl(candidate.homepage) : undefined;
    const byName = specimens.filter((s) => s.names.some((n) => nameKey(n) === key));
    const byHomepage = homepage
      ? specimens.filter((s) => s.urls.some((u) => normalizeUrl(u) === homepage))
      : [];

    const confirmed = byName.filter(
      (s) =>
        affiliationMatches(candidate.affiliation, s.affiliations) ||
        byHomepage.includes(s),
    );
    if (confirmed.length === 1) {
      const specimen = confirmed[0];
      const known = new Set(specimen.urls.map(normalizeUrl));
      return {
        kind: "matched",
        specimenId: specimen.id,
        candidate,
        newSourceUrls: sourceUrls(candidate).filter((u) => !known.has(normalizeUrl(u))),
      };
    }

    const possible = uniq([...byName, ...byHomepage].map((s) => s.id));
    if (possible.length > 0) {
      return {
        kind: "needs-review",
        candidate,
        possibleSpecimenIds: possible,
        reason:
          confirmed.length > 1
            ? "与多个已有对象匹配，无法确定"
            : byName.length > 0
              ? "同名，但单位缺失或不一致，可能不是同一人"
              : "主页与已有对象一致，但姓名不同",
      };
    }
    return { kind: "new", candidate };
  });
}
