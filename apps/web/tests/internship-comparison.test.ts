import { describe, expect, test } from "bun:test";
import {
  buildInternshipComparisonRows,
  buildInternshipFocusHints,
  internshipComparisonSupportedCandidateIds,
  isInternshipComparison,
} from "../src/lib/advisor-comparison";
import { internships } from "../src/lib/advisors";

const candidates = internshipComparisonSupportedCandidateIds.map((id) => {
  const item = internships.find((entry) => entry.candidateId === id);
  if (!item) throw new Error(`Missing collected internship: ${id}`);
  return item;
});

describe("source-bound internship comparison", () => {
  test("identifies internship comparison candidates accurately", () => {
    expect(isInternshipComparison(candidates)).toBe(true);
    expect(isInternshipComparison([])).toBe(false);
  });

  test("growth and practical perspectives retain role while separating participation routes", () => {
    const growth = buildInternshipComparisonRows(candidates, "growth");
    const practical = buildInternshipComparisonRows(candidates, "practical");

    expect(growth.find((row) => row.id === "role")).toEqual(
      practical.find((row) => row.id === "role"),
    );

    const growthRoutes = growth.find((row) => row.id === "route")?.cells;
    const practicalRoutes = practical.find((row) => row.id === "route")?.cells;

    expect(growthRoutes?.[0].text).toContain("开源社区贡献");
    expect(growthRoutes?.[1].text).toContain("Tomorrow's Partner");

    expect(practicalRoutes?.[0].text).toContain("至少 4 天");
    expect(practicalRoutes?.[0].text).toContain("上海徐汇");
    expect(practicalRoutes?.[1].text).toContain("不少于 3 个月");
    expect(practicalRoutes?.[1].text).toContain("导师书面同意书");

    expect(
      buildInternshipComparisonRows(candidates, "role").some(
        (row) => row.id === "route",
      ),
    ).toBe(false);
  });

  test("each claim uses only candidate's collected sources", () => {
    const rows = buildInternshipComparisonRows(candidates, "growth");
    for (const row of rows) {
      for (const cell of row.cells) {
        expect(cell.sources.length).toBeGreaterThan(0);
        for (const source of cell.sources) {
          expect(source.collection?.batchId).toBe("internship-batch-2026-10-16");
        }
      }
    }
    const role = rows.find((row) => row.id === "role");
    expect(role?.cells[0].sources.map((source) => source.url)).toContain(
      "https://github.com/open-compass/opencompass",
    );
    expect(
      role?.cells[0].sources.some((source) => source.url.includes("microsoft")),
    ).toBe(false);
  });

  test("focus suggestions are conditional and do not mutate the original snapshots", () => {
    const before = structuredClone(candidates);
    expect(buildInternshipFocusHints(candidates, "open")).toEqual([]);
    const systems = buildInternshipFocusHints(candidates, "systems");
    const evaluation = buildInternshipFocusHints(candidates, "evaluation");

    expect(systems[1].text).toContain("异构硬件");
    expect(evaluation[0].text).toContain("OpenCompass");

    expect(candidates).toEqual(before);
  });
});
