import { parseCollectedBatch } from "../../apps/web/src/lib/collected-batch";

const path = process.argv[2];
if (!path) {
  console.error("Usage: bun run discovery:validate <batch.json>");
  process.exit(1);
}

try {
  const batch = parseCollectedBatch(await Bun.file(path).json());
  console.log(
    JSON.stringify({
      batchId: batch.batchId,
      status: batch.status,
      advisors: batch.advisors.length,
      sources: batch.advisors.reduce((count, advisor) => count + advisor.sources.length, 0),
      scope: batch.scope,
      warnings: batch.warnings,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid collected batch");
  process.exit(1);
}
