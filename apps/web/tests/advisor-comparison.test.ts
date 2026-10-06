import { describe, expect, test } from "bun:test";
import {
  buildComparisonRows,
  buildResearchFocusHints,
  comparisonSupportedCandidateIds,
} from "../src/lib/advisor-comparison";
import { type Advisor, advisors } from "../src/lib/advisors";

const candidates = comparisonSupportedCandidateIds.map((id) => {
  const advisor = advisors.find((item) => item.candidateId === id);
  if (!advisor) throw new Error(`Missing collected advisor: ${id}`);
  return advisor;
});

describe("source-bound advisor comparison", () => {
  test("graduate and short-term perspectives retain research while separating participation routes", () => {
    const graduate = buildComparisonRows(candidates, "graduate");
    const shortTerm = buildComparisonRows(candidates, "short-term");
    expect(graduate.find((row) => row.id === "research")).toEqual(
      shortTerm.find((row) => row.id === "research"),
    );
    const graduateRoutes = graduate.find((row) => row.id === "route")?.cells;
    const shortTermRoutes = shortTerm.find((row) => row.id === "route")?.cells;
    expect(graduateRoutes?.[0].text).toContain("2027 级博士");
    expect(graduateRoutes?.[1].text).toContain("联合培养");
    expect(shortTermRoutes?.[0].text).toContain("RA／visiting students");
    expect(shortTermRoutes?.[1].text).toContain("仍未知");
    expect(shortTermRoutes?.[1].text).not.toContain("不接收");
    expect(
      buildComparisonRows(candidates, "research").some((row) => row.id === "route"),
    ).toBe(false);
  });

  test("each claim uses only its candidate's exact collected sources, regardless of source order", () => {
    const reordered = candidates.map((advisor) => ({
      ...advisor,
      sources: [...advisor.sources].reverse(),
    }));
    const rows = buildComparisonRows(reordered, "graduate");
    expect(rows).toEqual(buildComparisonRows(candidates, "graduate"));
    for (const row of rows) {
      for (const cell of row.cells) {
        const advisor = candidates.find(
          (item) => item.candidateId === cell.candidateId,
        );
        expect(cell.sources.length).toBeGreaterThan(0);
        for (const source of cell.sources) {
          expect(advisor?.sources).toContain(source);
          expect(source.collection?.batchId).toBe("xhs-recruitment-2026-10-05");
          expect(source.collectedAt).toBe("2026-10-05T12:24:39.000Z");
        }
      }
    }
    const research = rows.find((row) => row.id === "research");
    expect(research?.cells[0].sources.map((source) => source.url)).toEqual([
      "https://www.cs.hku.hk/people/academic-staff/jzuming",
    ]);
    expect(
      research?.cells[0].sources.some((source) => source.url.includes("sjtu")),
    ).toBe(false);
  });

  test("missing source or different capture suppresses the old claim without inventing a negative result", () => {
    for (const sources of [
      candidates[0].sources.filter(
        (source) => source.url !== "https://jzuming.github.io/",
      ),
      candidates[0].sources.map((source) => ({
        ...source,
        collectedAt: "2026-10-06T12:24:39.000Z",
      })),
    ]) {
      const candidate = { ...candidates[0], sources };
      const route = buildComparisonRows([candidate], "graduate").find(
        (row) => row.id === "route",
      )?.cells[0];
      expect(route?.text).toContain("暂不能确认");
      expect(route?.text).not.toContain("有资助");
      expect(route?.sources).toEqual([]);
    }
  });

  test("focus suggestions are conditional and do not mutate the original snapshots", () => {
    const before = structuredClone(candidates);
    expect(buildResearchFocusHints(candidates, "open")).toEqual([]);
    const software = buildResearchFocusHints(candidates, "software");
    const systems = buildResearchFocusHints(candidates, "ai-systems");
    expect(software[0].text).toContain("如果你关心软件可靠性");
    expect(systems[1].text).toContain("VLA／LLM 加速");
    expect(software[1].text).not.toEqual(systems[1].text);
    expect(candidates).toEqual(before);
    expect(software[0].sources[0].url).toBe(
      "https://www.cs.hku.hk/people/academic-staff/jzuming",
    );
  });

  test("zero, one and unsupported candidates preserve natural reading states", () => {
    expect(
      buildComparisonRows([], "research").every((row) => row.cells.length === 0),
    ).toBe(true);
    expect(
      buildComparisonRows([candidates[0]], "research").every(
        (row) => row.cells.length === 1,
      ),
    ).toBe(true);
    const unsupported: Advisor = {
      ...candidates[0],
      candidateId: "not-yet-compared",
    };
    for (const row of buildComparisonRows([unsupported], "short-term")) {
      expect(row.cells[0].candidateId).toBe("not-yet-compared");
      expect(row.cells[0].text).toContain("尚未整理");
      expect(row.cells[0].sources).toEqual([]);
    }
  });
});
