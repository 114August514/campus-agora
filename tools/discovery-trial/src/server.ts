// Local API for the web prototype. Binds to 127.0.0.1 only; the web dev server proxies
// /api here. Logs never include the user's question or any key.
//
//   GET  /api/discovery/config           services, missing keys, recipients, limits
//   POST /api/discovery/runs             { question } -> snapshot (202)
//   GET  /api/discovery/runs/:id         snapshot
//   POST /api/discovery/runs/:id/cancel  snapshot
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { loadSpecimens } from "./run-log.ts";
import { RunError, RunManager, buildServices } from "./run-manager.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.DISCOVERY_PORT ?? 8787);
const MAX_BODY_BYTES = 4096;
const synthetic = process.env.DISCOVERY_SYNTHETIC === "1";

const config = loadConfig();
const services = buildServices(config, synthetic);
const specimens = await loadSpecimens(
  fileURLToPath(new URL("../data/specimens.json", import.meta.url)),
);
const manager = new RunManager(services, specimens, config.limits, config.outDir);

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new RunError(413, "请求内容过长");
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    throw new RunError(400, "请求不是合法 JSON");
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const parts = url.pathname.split("/").filter(Boolean); // api, discovery, ...
  if (parts[0] !== "api" || parts[1] !== "discovery")
    return send(res, 404, { error: "未找到" });

  if (req.method === "GET" && parts[2] === "config" && parts.length === 3) {
    return send(res, 200, {
      mode: services.mode,
      ready: services.searchers.length > 0 && Boolean(services.extractor),
      missing: services.missing,
      searchers: services.searchers.map((s) => s.id),
      recipients: services.recipients,
      llmModel: services.llmModel,
      limits: config.limits,
    });
  }
  if (parts[2] !== "runs") return send(res, 404, { error: "未找到" });

  if (req.method === "POST" && parts.length === 3) {
    const body = await readJson(req);
    const snapshot = manager.start(body.question);
    console.log(`[run] ${snapshot.runId} started (${services.mode})`);
    return send(res, 202, snapshot);
  }
  const runId = parts[3];
  if (req.method === "GET" && runId && parts.length === 4) {
    const snapshot = manager.get(runId);
    return snapshot
      ? send(res, 200, snapshot)
      : send(res, 404, { error: "这次补查不存在或已过期" });
  }
  if (req.method === "POST" && runId && parts[4] === "cancel" && parts.length === 5) {
    const snapshot = manager.cancel(runId);
    if (snapshot) console.log(`[run] ${runId} cancel requested`);
    return snapshot
      ? send(res, 200, snapshot)
      : send(res, 404, { error: "这次补查不存在或已过期" });
  }
  return send(res, 405, { error: "不支持的请求" });
}

createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    if (error instanceof RunError)
      return send(res, error.status, { error: error.message });
    console.error(
      "[server] unexpected error:",
      error instanceof Error ? error.name : "unknown",
    );
    send(res, 500, { error: "服务内部错误" });
  });
}).listen(PORT, HOST, () => {
  const state =
    services.mode === "synthetic"
      ? "合成数据模式"
      : services.missing.length > 0
        ? `缺少 ${services.missing.join("、")}`
        : "已配置";
  console.log(`discovery API on http://${HOST}:${PORT} · ${state}`);
});
