import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { DEFAULT_LIMITS } from "../src/config.ts";
import {
  createSyntheticExtractor,
  createSyntheticReader,
  createSyntheticSearcher,
} from "../src/providers/synthetic.ts";
import {
  RunError,
  RunManager,
  type RunSnapshot,
  type Services,
} from "../src/run-manager.ts";
import type { PublicCandidate } from "../src/types.ts";

const SCALE = 0.02; // synthetic delays: ~20–30 ms per step

const specimens: PublicCandidate[] = [
  {
    id: "wang-xiang",
    names: ["王翔", "Xiang Wang"],
    affiliations: ["中国科学技术大学", "USTC"],
    urls: [],
    researchTopics: [],
  },
];

function services(overrides: Partial<Services> = {}): Services {
  return {
    mode: "synthetic",
    searchers: [
      createSyntheticSearcher("baidu", SCALE),
      createSyntheticSearcher("tavily", SCALE),
    ],
    reader: createSyntheticReader(SCALE),
    extractor: createSyntheticExtractor(20_000, SCALE),
    missing: [],
    recipients: [],
    llmModel: "synthetic",
    ...overrides,
  };
}

async function waitUntil(
  manager: RunManager,
  runId: string,
  done: (s: RunSnapshot) => boolean,
) {
  for (let i = 0; i < 200; i++) {
    const s = manager.get(runId);
    if (s && done(s)) return s;
    await sleep(10);
  }
  throw new Error("timed out");
}

test("a full synthetic run merges, holds same-name for review, and records the failed source", async () => {
  const manager = new RunManager(services(), specimens, DEFAULT_LIMITS);
  const started = manager.start("  程序正确性  ");
  assert.equal(started.status, "running");
  assert.equal(started.question, "程序正确性");
  const done = await waitUntil(manager, started.runId, (s) => s.status !== "running");

  assert.equal(done.status, "completed");
  assert.deepEqual(done.outcomes.map((o) => o.kind).sort(), [
    "matched",
    "needs-review",
    "new",
  ]);
  assert.equal(done.failures.length, 1);
  assert.equal(done.failures[0].stage, "read");
  assert.ok(done.events.every((e) => e.state !== "running"));
  const lead = done.outcomes.find((o) => o.kind === "new");
  assert.equal(lead?.candidate.evidence.filter((e) => !e.quoteVerified).length, 1);
});

test("cancel stops the run immediately and late results are not written", async () => {
  const manager = new RunManager(services(), specimens, DEFAULT_LIMITS);
  const { runId } = manager.start("q");
  // Wait until the first page is being read, then cancel.
  await waitUntil(manager, runId, (s) => s.events.some((e) => e.stage === "read"));
  const cancelled = manager.cancel(runId);
  assert.equal(cancelled?.status, "cancelled");
  const outcomesAtCancel = cancelled?.outcomes.length;
  await sleep(300); // longer than the remaining synthetic steps
  const later = manager.get(runId);
  assert.equal(later?.status, "cancelled");
  assert.equal(later?.outcomes.length, outcomesAtCancel);
  assert.ok(later?.events.every((e) => e.state !== "running"));
  assert.ok(later?.events.some((e) => e.state === "skipped"));
});

test("only one run at a time, and input is validated", async () => {
  const manager = new RunManager(services(), specimens, DEFAULT_LIMITS);
  const { runId } = manager.start("q");
  assert.throws(
    () => manager.start("q2"),
    (e: unknown) => e instanceof RunError && e.status === 409,
  );
  manager.cancel(runId);
  assert.throws(
    () => manager.start("   "),
    (e: unknown) => e instanceof RunError && e.status === 400,
  );
  assert.throws(
    () => manager.start("长".repeat(301)),
    (e: unknown) => e instanceof RunError && e.status === 400,
  );
  assert.equal(manager.start("q3").status, "running");
});

test("missing keys refuse to start instead of pretending to search", () => {
  const manager = new RunManager(
    services({
      mode: "live",
      searchers: [],
      extractor: undefined,
      missing: ["QIANFAN_API_KEY", "ZHIPU_API_KEY"],
    }),
    specimens,
    DEFAULT_LIMITS,
  );
  assert.throws(
    () => manager.start("q"),
    (e: unknown) => e instanceof RunError && e.status === 503,
  );
});
