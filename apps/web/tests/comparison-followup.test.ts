import { describe, expect, test } from "bun:test";
import {
  type ComparisonPerspective,
  buildComparisonRows,
} from "../src/lib/advisor-comparison";
import { advisors } from "../src/lib/advisors";
import {
  getFollowupQuery,
  getSupplementalSources,
} from "../src/lib/comparison-followup";
import {
  EXPLORATION_STORAGE_KEY,
  ExplorationStoreError,
  type SourceSnapshot,
  createExplorationStore,
} from "../src/lib/exploration-store";

class MemoryStorage {
  data = new Map<string, string>();
  failWrite = false;

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("quota exceeded");
    this.data.set(key, value);
  }
}

const advisor = advisors.find((entry) => entry.candidateId === "zuming-jiang");
if (!advisor) throw new Error("Missing collected advisor: zuming-jiang");
const jiang = advisor;

function newReading(): SourceSnapshot {
  return {
    ...jiang.sources[0],
    title: "Synthetic follow-up reading",
    content: "Synthetic evidence for a follow-up test, not an actual discovery.",
    kind: "live",
    collectedAt: "2026-10-07T04:00:00.000Z",
    query: getFollowupQuery(jiang, "short-term"),
    relevanceEvidence: ["Synthetic relevant passage."],
    unknowns: ["Current eligibility remains unknown."],
    collection: undefined,
  };
}

describe("comparison follow-up", () => {
  test("editable query seeds use public identity and the selected participation perspective", () => {
    const publicBefore = structuredClone(jiang);
    const seeds = new Map<ComparisonPerspective, string>();
    for (const perspective of ["research", "graduate", "short-term"] as const) {
      const query = getFollowupQuery(jiang, perspective);
      expect(query).toContain(jiang.name);
      expect(query).toContain(jiang.institution);
      expect(query).not.toContain(jiang.unknowns);
      expect(query).not.toContain(jiang.sources[0].content);
      seeds.set(perspective, query);
    }
    expect(new Set(seeds.values()).size).toBe(3);
    expect(seeds.get("research")).toContain("论文");
    expect(seeds.get("graduate")).toContain("PhD");
    expect(seeds.get("short-term")).toContain("RA");
    expect(seeds.get("short-term")).toContain("visiting students");
    expect(jiang).toEqual(publicBefore);
  });

  test("saved follow-up evidence survives reopening without changing the static comparison or another topic", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const summer = store.createTopic({ name: "Synthetic short-term topic" });
    const graduate = store.createTopic({ name: "Synthetic graduate topic" });
    const fixedComparison = buildComparisonRows([jiang], "short-term");
    const fixedAdvisor = structuredClone(jiang);
    store.saveCandidate(summer.id, jiang, {
      reason: "Short-term private reason",
      questions: ["Short-term private question"],
    });
    store.saveCandidate(graduate.id, jiang, {
      reason: "Graduate private reason",
      questions: ["Graduate private question"],
    });
    const graduateBefore = store.getTopic(graduate.id);
    const reading = newReading();
    store.saveCandidate(summer.id, { ...jiang, sources: [reading] });
    store.saveCandidate(summer.id, { ...jiang, sources: [reading] });

    const reopened = createExplorationStore(storage);
    const savedSummer = reopened.getTopic(summer.id);
    const supplemental = getSupplementalSources(jiang, savedSummer);
    expect(savedSummer?.candidates).toHaveLength(1);
    expect(savedSummer?.candidates[0].candidate.sources).toHaveLength(
      jiang.sources.length + 1,
    );
    expect(savedSummer?.candidates[0]).toMatchObject({
      reason: "Short-term private reason",
      questions: ["Short-term private question"],
    });
    expect(supplemental).toEqual([reading]);
    expect(supplemental[0]).toBe(savedSummer?.candidates[0].candidate.sources.at(-1));
    expect(reopened.getTopic(graduate.id)).toEqual(graduateBefore);
    expect(getSupplementalSources(jiang, reopened.getTopic(graduate.id))).toEqual([]);
    expect(buildComparisonRows([jiang], "short-term")).toEqual(fixedComparison);
    expect(jiang).toEqual(fixedAdvisor);
  });

  test("the same URL retains a later capture, a new query and changed reading scope as separate evidence", () => {
    const store = createExplorationStore(new MemoryStorage());
    const topic = store.createTopic({ name: "Synthetic capture history" });
    store.saveCandidate(topic.id, jiang);
    const original = jiang.sources[0];
    const captures: SourceSnapshot[] = [
      { ...original, collectedAt: "2026-10-07T04:00:00.000Z" },
      { ...original, query: "Another public question about the same page" },
      { ...original, content: "Synthetic updated body at the same address" },
      {
        ...original,
        collection: {
          method: "web_read",
          contentKind: "body",
          readStatus: "complete",
          scope: "Synthetic follow-up scope",
          batchId: "synthetic-followup-test",
        },
      },
    ];
    for (const source of captures) {
      store.saveCandidate(topic.id, { ...jiang, sources: [source] });
    }
    expect(getSupplementalSources(jiang, store.getTopic(topic.id))).toEqual(captures);
    expect(store.getTopic(topic.id)?.candidates[0].candidate.sources).toContainEqual(
      original,
    );
  });

  test("missing topic or a different candidate never supplies someone else's evidence", () => {
    const store = createExplorationStore(new MemoryStorage());
    const topic = store.createTopic({ name: "Synthetic unrelated candidate" });
    store.saveCandidate(topic.id, {
      ...jiang,
      candidateId: "another-person",
      sources: [newReading()],
    });
    expect(getSupplementalSources(jiang)).toEqual([]);
    expect(getSupplementalSources(jiang, store.getTopic(topic.id))).toEqual([]);
  });

  test("failed follow-up saving leaves existing evidence and private records available for retry", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "Synthetic failed save" });
    store.saveCandidate(topic.id, jiang, {
      reason: "Already saved private reason",
      questions: ["Already saved question"],
    });
    const previousRecord = store.getTopic(topic.id);
    const previousData = storage.getItem(EXPLORATION_STORAGE_KEY);
    const reading = newReading();
    storage.failWrite = true;
    expect(() =>
      store.saveCandidate(topic.id, { ...jiang, sources: [reading] }),
    ).toThrow(ExplorationStoreError);
    expect(storage.getItem(EXPLORATION_STORAGE_KEY)).toBe(previousData);
    expect(store.getTopic(topic.id)).toEqual(previousRecord);
    expect(getSupplementalSources(jiang, store.getTopic(topic.id))).toEqual([]);

    storage.failWrite = false;
    store.saveCandidate(topic.id, { ...jiang, sources: [reading] });
    expect(getSupplementalSources(jiang, store.getTopic(topic.id))).toEqual([reading]);
    expect(store.getTopic(topic.id)?.candidates[0]).toMatchObject({
      reason: "Already saved private reason",
      questions: ["Already saved question"],
    });
  });
});
