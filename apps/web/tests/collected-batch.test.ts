import { describe, expect, test } from "bun:test";
import {
  mergeCollectedAdvisors,
  parseCollectedBatch,
} from "../src/lib/collected-batch";
import { createExplorationStore } from "../src/lib/exploration-store";

function inputBatch() {
  return {
    version: 1,
    batchId: "example-collection",
    query: "software research",
    scope: "One public recruitment page, text only",
    collector: "Example browser collector",
    completedAt: "2026-10-04T12:00:00.000Z",
    status: "partial",
    warnings: ["Images were not read."],
    advisors: [
      {
        candidateId: "example-collected-advisor",
        name: "Example Researcher",
        institution: "Example University",
        research: "Software systems",
        approach: "A summary of the source's research description.",
        participation: "Participation details need confirmation.",
        unknowns: "Availability is unknown.",
        sources: [
          {
            url: "HTTPS://EXAMPLE.EDU:443/research",
            lookupUrl: "HTTPS://EXAMPLE.EDU:443/search?keyword=software",
            accessNote: "Open the site search and find the recruitment page by title.",
            title: "Public recruitment page",
            content: "A collected summary, not the full article.",
            collectedAt: "2026-10-04T11:00:00.000Z",
            publishedAt: "Edited six days before collection",
            collection: {
              method: "browser_dom",
              contentKind: "summary",
              readStatus: "partial",
              scope: "Visible article text, excluding images",
              batchId: "example-collection",
            },
          },
        ],
      },
    ],
  };
}

describe("collected batch", () => {
  test("merges repeated candidates by capture time, preserving historical sources regardless of batch order", () => {
    const older = parseCollectedBatch(inputBatch());
    const newInput = inputBatch();
    newInput.batchId = "later-collection";
    newInput.completedAt = "2026-10-05T12:00:00.000Z";
    newInput.advisors[0].research = "Updated software systems description";
    newInput.advisors[0].sources[0].collectedAt = "2026-10-05T11:00:00.000Z";
    newInput.advisors[0].sources[0].collection.batchId = newInput.batchId;
    newInput.advisors[0].sources.push(structuredClone(newInput.advisors[0].sources[0]));
    const newer = parseCollectedBatch(newInput);

    const merged = mergeCollectedAdvisors([], [newer, older]);
    expect(merged).toHaveLength(1);
    expect(merged[0].research).toBe("Updated software systems description");
    expect(merged[0].sources.map((source) => source.collectedAt)).toEqual([
      "2026-10-04T11:00:00.000Z",
      "2026-10-05T11:00:00.000Z",
    ]);
    expect(merged[0].sources.map((source) => source.collection?.batchId)).toEqual([
      "example-collection",
      "later-collection",
    ]);
    expect(mergeCollectedAdvisors([], [older, newer])).toEqual(merged);
    expect(older.advisors[0].research).toBe("Software systems");
  });

  test.each(["name", "institution"] as const)(
    "rejects conflicting %s before combining samples and batches",
    (field) => {
      const batch = parseCollectedBatch(inputBatch());
      const sample = structuredClone(batch.advisors[0]);
      sample[field] = "A different identity";
      expect(() => mergeCollectedAdvisors([sample], [batch])).toThrow("身份");
    },
  );

  test("canonicalizes public sources while preserving actual capture limits and original dates", () => {
    const result = parseCollectedBatch(inputBatch());
    expect(result.advisors[0].sources[0]).toMatchObject({
      url: "https://example.edu/research",
      lookupUrl: "https://example.edu/search?keyword=software",
      accessNote: "Open the site search and find the recruitment page by title.",
      kind: "snapshot",
      query: "software research",
      publishedAt: "Edited six days before collection",
      collection: {
        method: "browser_dom",
        contentKind: "summary",
        readStatus: "partial",
      },
    });
    expect(result.warnings).toEqual(["Images were not read."]);
  });

  test("imported source provenance survives saving and reopening without changing private reasons", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "My exploration" });
    const original = parseCollectedBatch(inputBatch()).advisors[0];
    store.saveCandidate(topic.id, original, {
      reason: "My private decision",
      questions: ["Who supervises students?"],
    });
    const otherBatch = structuredClone(original);
    if (otherBatch.sources[0].collection)
      otherBatch.sources[0].collection.batchId = "a-second-capture";
    store.saveCandidate(topic.id, otherBatch);
    if (original.sources[0].collection)
      original.sources[0].collection.scope = "Unsaved later edit";

    const saved = createExplorationStore(storage).getTopic(topic.id)?.candidates[0];
    expect(saved?.reason).toBe("My private decision");
    expect(saved?.questions).toEqual(["Who supervises students?"]);
    expect(saved?.candidate.sources).toHaveLength(2);
    expect(saved?.candidate.sources[0]).toMatchObject({
      url: "https://example.edu/research",
      lookupUrl: "https://example.edu/search?keyword=software",
      accessNote: "Open the site search and find the recruitment page by title.",
    });
    expect(saved?.candidate.sources[0].collection).toEqual({
      method: "browser_dom",
      contentKind: "summary",
      readStatus: "partial",
      scope: "Visible article text, excluding images",
      batchId: "example-collection",
    });
    expect(saved?.candidate.sources[1].collection?.batchId).toBe("a-second-capture");
  });

  test.each([
    "javascript:alert(1)",
    "https://user:password@example.edu/article",
    "https://example.edu/article?xsec_token=private",
    "https://example.edu/article?access_token=private",
    "https://example.edu/article#session_id=private",
  ])("rejects non-page or credential-bearing source URLs: %s", (url) => {
    const input = inputBatch();
    input.advisors[0].sources[0].url = url;
    expect(() => parseCollectedBatch(input)).toThrow();
  });

  test.each([
    "javascript:alert(1)",
    "https://user:password@example.edu/search",
    "https://example.edu/search?xsec_token=private",
    "https://example.edu/search?access_token=private",
    "https://example.edu/search#session_id=private",
    "https://another.example/search?keyword=software",
  ])("rejects unsafe or off-site lookup URLs: %s", (lookupUrl) => {
    const input = inputBatch();
    input.advisors[0].sources[0].lookupUrl = lookupUrl;
    expect(() => parseCollectedBatch(input)).toThrow();
  });

  test("rejects wrong versions, invalid ISO dates, repeated candidates and inconsistent capture identities", () => {
    const version = inputBatch();
    version.version = 2;
    expect(() => parseCollectedBatch(version)).toThrow("版本");
    const date = inputBatch();
    date.completedAt = "October 4";
    expect(() => parseCollectedBatch(date)).toThrow("ISO");
    date.completedAt = "2026-02-30T12:00:00.000Z";
    expect(() => parseCollectedBatch(date)).toThrow("ISO");
    const duplicate = inputBatch();
    duplicate.advisors.push(structuredClone(duplicate.advisors[0]));
    expect(() => parseCollectedBatch(duplicate)).toThrow("重复");
    const collection = inputBatch();
    collection.advisors[0].sources[0].collection.batchId = "another-batch";
    expect(() => parseCollectedBatch(collection)).toThrow("批次标识");
  });

  test("private notes and unknown JSON fields cannot propagate into public advisors", () => {
    const input = inputBatch();
    expect(() => parseCollectedBatch({ ...input, topics: [] })).toThrow("未约定字段");
    expect(() =>
      parseCollectedBatch({
        ...input,
        advisors: [{ ...input.advisors[0], reason: "private" }],
      }),
    ).toThrow("私人笔记");
    expect(() =>
      parseCollectedBatch({
        ...input,
        advisors: [
          {
            ...input.advisors[0],
            sources: [{ ...input.advisors[0].sources[0], questions: ["private"] }],
          },
        ],
      }),
    ).toThrow("私人笔记");
  });
});
