import type { Advisor } from "./advisors";
import type { SourceCollection, SourceSnapshot } from "./exploration-store";

export interface CollectedBatch {
  version: 1;
  batchId: string;
  query: string;
  scope: string;
  collector: string;
  completedAt: string;
  status: "complete" | "partial" | "failed";
  warnings: string[];
  advisors: Advisor[];
}

/** Reuse each candidate once while retaining independently captured sources. */
export function mergeCollectedAdvisors(
  samples: Advisor[],
  batches: CollectedBatch[],
): Advisor[] {
  const candidates = new Map<string, Advisor>();
  const orderedBatches = [...batches].sort(
    (left, right) =>
      Date.parse(left.completedAt) - Date.parse(right.completedAt) ||
      left.batchId.localeCompare(right.batchId),
  );
  for (const advisor of [
    ...samples,
    ...orderedBatches.flatMap((batch) => batch.advisors),
  ]) {
    const existing = candidates.get(advisor.candidateId);
    if (
      existing &&
      (existing.name !== advisor.name || existing.institution !== advisor.institution)
    ) {
      throw new Error(`候选${advisor.candidateId}的姓名或机构冲突，请核对身份后导入。`);
    }
    const sources = new Map<string, SourceSnapshot>();
    for (const source of [...(existing?.sources ?? []), ...advisor.sources]) {
      const key = JSON.stringify([
        source.url,
        source.collectedAt,
        source.content,
        source.query,
        source.collection,
      ]);
      sources.set(key, { ...sources.get(key), ...source });
    }
    candidates.set(advisor.candidateId, { ...advisor, sources: [...sources.values()] });
  }
  return [...candidates.values()];
}

type RecordValue = Record<string, unknown>;

function object(value: unknown, fields: string[], context: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`预采集批次的${context}需要是对象。`);
  }
  const record = value as RecordValue;
  if (Object.keys(record).some((key) => !fields.includes(key))) {
    throw new Error(`预采集批次的${context}包含未约定字段；不能导入私人笔记。`);
  }
  return record;
}

function text(value: unknown, context: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`预采集批次的${context}需要是${allowEmpty ? "" : "非空"}字符串。`);
  }
  return value;
}

function time(value: unknown, context: string): string {
  const result = text(value, context);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      result,
    );
  if (
    !match ||
    !Number.isFinite(Date.parse(result)) ||
    Number(match[2]) < 1 ||
    Number(match[2]) > 12 ||
    Number(match[3]) < 1 ||
    Number(match[3]) >
      new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate()
  ) {
    throw new Error(`预采集批次的${context}需要是有效ISO采集时间。`);
  }
  return result;
}

function texts(value: unknown, context: string): string[] {
  if (!Array.isArray(value))
    throw new Error(`预采集批次的${context}需要是字符串数组。`);
  return value.map((item) => text(item, context, true));
}

function sourceUrl(value: unknown): string {
  let url: URL;
  try {
    url = new URL(text(value, "来源URL"));
  } catch {
    throw new Error("预采集来源需要有效的HTTP(S)原始页面URL。");
  }
  const credentialKey =
    /(?:^|[_-])(?:token|auth|authorization|session|sessionid|password|credential|apikey|api_key)(?:$|[_-])/i;
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    [...url.searchParams.keys()].some((key) => credentialKey.test(key)) ||
    [...new URLSearchParams(url.hash.slice(1)).keys()].some((key) =>
      credentialKey.test(key),
    )
  ) {
    throw new Error("预采集来源只接受不带登录凭据或token的HTTP(S)页面URL。");
  }
  return url.href;
}

function collection(value: unknown, batchId: string): SourceCollection {
  const record = object(
    value,
    ["method", "contentKind", "readStatus", "scope", "batchId"],
    "来源采集信息",
  );
  if (
    (record.method !== "browser_dom" && record.method !== "web_read") ||
    (record.contentKind !== "summary" && record.contentKind !== "body") ||
    (record.readStatus !== "partial" && record.readStatus !== "complete") ||
    record.batchId !== batchId
  ) {
    throw new Error("预采集来源的读取方式、内容类型、状态或批次标识无效。");
  }
  return {
    method: record.method as SourceCollection["method"],
    contentKind: record.contentKind as SourceCollection["contentKind"],
    readStatus: record.readStatus as SourceCollection["readStatus"],
    scope: text(record.scope, "来源采集范围"),
    batchId,
  };
}

function source(value: unknown, batchId: string, query: string): SourceSnapshot {
  const record = object(
    value,
    [
      "url",
      "lookupUrl",
      "accessNote",
      "title",
      "content",
      "collectedAt",
      "kind",
      "publishedAt",
      "query",
      "relevanceEvidence",
      "unknowns",
      "collection",
    ],
    "来源",
  );
  if (record.kind !== undefined && record.kind !== "snapshot") {
    throw new Error("预采集来源必须标为snapshot，不能冒充本次实时查找。");
  }
  const url = sourceUrl(record.url);
  const lookupUrl =
    record.lookupUrl === undefined ? undefined : sourceUrl(record.lookupUrl);
  if (lookupUrl && new URL(lookupUrl).origin !== new URL(url).origin) {
    throw new Error("预采集来源的站内查找URL需要与原始页面同源。");
  }
  return {
    url,
    ...(lookupUrl === undefined ? {} : { lookupUrl }),
    ...(record.accessNote === undefined
      ? {}
      : { accessNote: text(record.accessNote, "来源访问说明") }),
    title: text(record.title, "来源标题"),
    content: text(record.content, "来源正文或摘要"),
    collectedAt: time(record.collectedAt, "来源采集时间"),
    kind: "snapshot",
    query: record.query === undefined ? query : text(record.query, "来源查询", true),
    ...(record.publishedAt === undefined
      ? {}
      : { publishedAt: text(record.publishedAt, "原页时间标签") }),
    ...(record.relevanceEvidence === undefined
      ? {}
      : { relevanceEvidence: texts(record.relevanceEvidence, "匹配依据") }),
    ...(record.unknowns === undefined
      ? {}
      : { unknowns: texts(record.unknowns, "未读取或未知事项") }),
    ...(record.collection === undefined
      ? {}
      : { collection: collection(record.collection, batchId) }),
  };
}

/** Parses public batch data only; never accepts private exploration records. */
export function parseCollectedBatch(input: unknown): CollectedBatch {
  const record = object(
    input,
    [
      "version",
      "batchId",
      "query",
      "scope",
      "collector",
      "completedAt",
      "status",
      "warnings",
      "advisors",
    ],
    "批次",
  );
  if (record.version !== 1) throw new Error("预采集批次版本不受支持。");
  if (
    record.status !== "complete" &&
    record.status !== "partial" &&
    record.status !== "failed"
  ) {
    throw new Error("预采集批次状态无效。");
  }
  const batchId = text(record.batchId, "批次标识");
  const query = text(record.query, "查询", true);
  if (!Array.isArray(record.advisors)) throw new Error("预采集候选需要是数组。");
  const ids = new Set<string>();
  const advisors = record.advisors.map((value): Advisor => {
    const advisor = object(
      value,
      [
        "candidateId",
        "name",
        "institution",
        "research",
        "approach",
        "participation",
        "unknowns",
        "sources",
      ],
      "候选",
    );
    const candidateId = text(advisor.candidateId, "候选标识");
    if (ids.has(candidateId)) throw new Error("预采集批次存在重复候选标识。");
    ids.add(candidateId);
    if (!Array.isArray(advisor.sources) || !advisor.sources.length) {
      throw new Error("预采集候选至少需要一个已取得内容的来源。");
    }
    return {
      candidateId,
      name: text(advisor.name, "候选姓名"),
      institution: text(advisor.institution, "候选机构"),
      research: text(advisor.research, "研究说明", true),
      approach: text(advisor.approach, "工作说明", true),
      participation: text(advisor.participation, "参与说明", true),
      unknowns: text(advisor.unknowns, "候选未知事项", true),
      sources: advisor.sources.map((value) => source(value, batchId, query)),
    };
  });
  return {
    version: 1,
    batchId,
    query,
    scope: text(record.scope, "范围"),
    collector: text(record.collector, "采集方式"),
    completedAt: time(record.completedAt, "批次完成时间"),
    status: record.status as CollectedBatch["status"],
    warnings: texts(record.warnings, "读取限制"),
    advisors,
  };
}
