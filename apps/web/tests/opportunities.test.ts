import { describe, expect, test } from "bun:test";
import {
  SCENARIOS,
  getScenario,
  matchesOpportunity,
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../src/lib/opportunities";

describe("opportunity data", () => {
  test("every item has a unique id, a type, an https entry and a check date", () => {
    expect(new Set(opportunities.map((item) => item.id)).size).toBe(
      opportunities.length,
    );
    for (const item of opportunities) {
      expect(item.types.length).toBeGreaterThan(0);
      expect(item.types.every((type) => type in opportunityTypeText)).toBe(true);
      expect(new URL(item.entry.url).protocol).toBe("https:");
      expect(item.entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("ended batches say what must not be inferred", () => {
    const ended = opportunities.filter((item) => item.timing === "historical");
    expect(ended.length).toBeGreaterThan(0);
    for (const item of ended) expect(item.caveat.trim().length).toBeGreaterThan(0);
  });

  test("every type has at least one entry", () => {
    for (const type of opportunityTypes) {
      expect(opportunities.some((item) => item.types.includes(type))).toBe(true);
    }
  });

  test("search matches all terms across name, content and type labels", () => {
    const contest = opportunities.find((item) => item.id === "physics-experiment-2026");
    if (!contest) throw new Error("fixture missing");
    expect(matchesOpportunity(contest, "")).toBe(true);
    expect(matchesOpportunity(contest, "竞赛 团队")).toBe(true);
    expect(matchesOpportunity(contest, "竞赛 算力")).toBe(false);
  });

  test("scenario abstraction provides scenario definitions with fallback to advisor", () => {
    expect(getScenario("advisor").title).toBe("选导师");
    expect(getScenario("internship").title).toBe("找实习");
    expect(getScenario("competition").title).toBe("打比赛");
    expect(getScenario("unknown").title).toBe("选导师");
  });
});
