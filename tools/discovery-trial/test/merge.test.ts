import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeWithSpecimens } from "../src/pipeline/merge.ts";
import type { Evidence, ExtractedCandidate, PublicCandidate } from "../src/types.ts";

const specimens: PublicCandidate[] = [
  {
    id: "wang-xiang",
    names: ["王翔", "Xiang Wang"],
    affiliations: ["中国科学技术大学", "USTC"],
    urls: ["https://xiangwang1223.github.io/"],
    researchTopics: [],
  },
];

function evidence(
  sourceUrl: string,
  quote: string,
  origin: Evidence["origin"] = "live",
): Evidence {
  return {
    sourceUrl,
    quote,
    supports: "",
    retrievedAt: "2026-10-14T00:00:00Z",
    origin,
    quoteVerified: true,
  };
}

function candidate(overrides: Partial<ExtractedCandidate>): ExtractedCandidate {
  return {
    name: "",
    affiliation: null,
    homepage: null,
    researchTopics: [],
    relationToQuestion: "",
    routes: [],
    evidence: [],
    unknowns: [],
    ...overrides,
  };
}

test("known person with matching affiliation reuses the existing object and lists new sources", () => {
  const [outcome] = mergeWithSpecimens(
    [
      candidate({
        name: "Xiang Wang",
        affiliation: "University of Science and Technology of China (USTC)",
        evidence: [evidence("https://news.ustc.edu.cn/a", "知识编辑方法")],
      }),
    ],
    specimens,
  );
  assert.equal(outcome.kind, "matched");
  assert.equal(outcome.kind === "matched" && outcome.specimenId, "wang-xiang");
  assert.deepEqual(outcome.kind === "matched" && outcome.newSourceUrls, [
    "https://news.ustc.edu.cn/a",
  ]);
});

test("same name at a different institution is held for review, not merged", () => {
  const [outcome] = mergeWithSpecimens(
    [candidate({ name: "王翔", affiliation: "某某大学" })],
    specimens,
  );
  assert.equal(outcome.kind, "needs-review");
});

test("same name without affiliation is held for review", () => {
  const [outcome] = mergeWithSpecimens([candidate({ name: "王翔" })], specimens);
  assert.equal(outcome.kind, "needs-review");
});

test("homepage match confirms identity even when affiliation text is missing", () => {
  const [outcome] = mergeWithSpecimens(
    [
      candidate({
        name: "王翔",
        homepage: "http://xiangwang1223.github.io/index.html",
      }),
    ],
    specimens,
  );
  assert.equal(outcome.kind, "matched");
});

test("reading the same source twice does not create a duplicate candidate or evidence", () => {
  const sighting = () =>
    candidate({
      name: "李四",
      affiliation: "清华大学",
      evidence: [evidence("https://a.edu/li", "研究程序分析")],
    });
  const cachedSighting = candidate({
    name: "李四",
    affiliation: "清华大学",
    evidence: [evidence("https://www.a.edu/li/", "研究 程序分析", "provider-cache")],
  });
  const outcomes = mergeWithSpecimens(
    [sighting(), sighting(), cachedSighting],
    specimens,
  );
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].kind, "new");
  assert.equal(outcomes[0].candidate.evidence.length, 1);
  assert.equal(outcomes[0].candidate.evidence[0].origin, "live");
});
