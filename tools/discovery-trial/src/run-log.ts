import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PublicCandidate, RunRecord } from "./types.ts";

export async function loadSpecimens(path: string): Promise<PublicCandidate[]> {
  const data = JSON.parse(await readFile(path, "utf8")) as {
    candidates: PublicCandidate[];
  };
  return data.candidates;
}

/** Writes the full run record (public data only) to <outDir>/runs/<runId>.json. */
export async function writeRunRecord(
  outDir: string,
  record: RunRecord,
): Promise<string> {
  const dir = join(outDir, "runs");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${record.runId}.json`);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}

export function summarize(record: RunRecord): string {
  const lines = [
    `问题：${record.question}`,
    `状态：${record.status}${record.stopDetail ? `（${record.stopDetail}）` : ""}`,
    `调用：搜索 ${record.usage.search} / 读取 ${record.usage.read} / 模型 ${record.usage.llm}`,
    `搜索结果 ${record.hits.length} 条，读取正文 ${record.reads.length} 页，失败 ${record.failures.length} 项`,
    "",
  ];
  for (const outcome of record.outcomes) {
    const c = outcome.candidate;
    const evidence = [...c.evidence, ...c.routes.flatMap((r) => r.evidence)];
    const verified = evidence.filter((e) => e.quoteVerified).length;
    const label =
      outcome.kind === "matched"
        ? `复用已有对象 ${outcome.specimenId}，新来源 ${outcome.newSourceUrls.length}`
        : outcome.kind === "new"
          ? "新候选"
          : `待核：${outcome.reason}（${outcome.possibleSpecimenIds.join(", ")}）`;
    lines.push(`- ${c.name}｜${c.affiliation ?? "单位未知"}｜${label}`);
    lines.push(
      `  依据 ${evidence.length} 条，原文核对通过 ${verified} 条；未知 ${c.unknowns.length} 项`,
    );
  }
  if (record.outcomes.length === 0) lines.push("（本次没有提取到相关人物）");
  for (const f of record.failures)
    lines.push(`! ${f.stage} ${f.provider} ${f.target}: ${f.message}`);
  return lines.join("\n");
}
