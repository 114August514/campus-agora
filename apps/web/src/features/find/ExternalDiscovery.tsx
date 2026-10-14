// External discovery against the local API. Shows which services receive the question
// before sending, live step progress, cancel with partial results kept, and merge
// outcomes. Synthetic server mode is always labelled as such.
import { CheckIcon, CircleSlashIcon, StopIcon, XIcon } from "@primer/octicons-react";
import { Banner, Button, Heading, Spinner, Stack, Text } from "@primer/react";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type DiscoveryConfig,
  type RunEvent,
  type RunSnapshot,
  discoveryApi,
} from "../../api/discovery";
import { OutcomeItem } from "./OutcomeItem";

type SendState = "idle" | "sending" | "sent" | "unknown";

const providerName: Record<string, string> = {
  baidu: "百度千帆",
  tavily: "Tavily",
  jina: "Jina",
  llm: "模型",
};

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

function eventText(e: RunEvent): string {
  const who = providerName[e.provider] ?? e.provider;
  if (e.stage === "search") return `${who} 搜索“${e.target}”`;
  if (e.stage === "read") return `读取 ${shortUrl(e.target)}`;
  return `整理 ${shortUrl(e.target)}`;
}

export function ExternalDiscovery({ query }: { query: string }) {
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);

  const loadConfig = useCallback(() => {
    setConfigError(null);
    discoveryApi
      .config()
      .then(setConfig)
      .catch((e: unknown) => {
        setConfig(null);
        setConfigError(e instanceof Error ? e.message : "连不上补查服务");
      });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const running = run?.status === "running";
  const runId = run?.runId;
  useEffect(() => {
    if (!running || !runId) return;
    const timer = window.setInterval(() => {
      discoveryApi
        .get(runId)
        .then((s) => {
          setPollError(false);
          // Never let a late poll overwrite a finished (e.g. cancelled) snapshot.
          setRun((prev) =>
            prev?.runId === s.runId && prev.status !== "running" ? prev : s,
          );
        })
        .catch(() => setPollError(true));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, runId]);

  const start = async () => {
    setActionError(null);
    setSendState("sending");
    try {
      setRun(await discoveryApi.start(query.trim()));
      setSendState("sent");
    } catch (e) {
      // A lost connection means we cannot tell whether the request arrived.
      setSendState(e instanceof ApiError && e.status !== 0 ? "idle" : "unknown");
      setActionError(e instanceof Error ? e.message : "补查没能开始");
    }
  };

  const cancel = async () => {
    if (!runId) return;
    try {
      setRun(await discoveryApi.cancel(runId));
    } catch (e) {
      setActionError(
        e instanceof Error ? `中止请求没有送达：${e.message}` : "中止请求没有送达",
      );
    }
  };

  const synthetic = config?.mode === "synthetic" || run?.mode === "synthetic";
  const canStart =
    Boolean(config?.ready) &&
    Boolean(query.trim()) &&
    !running &&
    sendState !== "sending";

  return (
    <Stack
      as="section"
      gap="normal"
      paddingBlock="normal"
      aria-labelledby="external-heading"
    >
      <Heading as="h2" variant="medium" id="external-heading">
        外部补查
      </Heading>

      {!config && !configError && (
        <Stack direction="horizontal" gap="condensed" align="center">
          <Spinner size="small" srText="正在连接补查服务" />
          <Text size="medium">正在连接补查服务</Text>
        </Stack>
      )}
      {configError && (
        <Banner
          variant="warning"
          title="补查服务未启动"
          description="在 tools/discovery-trial 运行 npm run serve 后重试。已有资料仍可正常浏览、比较和保存。"
          primaryAction={
            <Banner.PrimaryAction onClick={loadConfig}>重试</Banner.PrimaryAction>
          }
        />
      )}
      {synthetic && (
        <Banner
          variant="warning"
          title="合成数据模式"
          description="补查服务正以合成数据运行，只用于检查流程。下面的过程和结果都不是真实发现。"
        />
      )}
      {config && config.mode === "live" && !config.ready && (
        <Banner
          variant="warning"
          title="补查服务未配置"
          description={`缺少 ${config.missing.join("、")}。已有资料仍可正常浏览、比较和保存。`}
        />
      )}

      {config && (
        <Stack gap="tight">
          <Text size="medium">
            已有资料里没有合适的人选时，可以针对当前输入搜索国内外来源、读取正文并整理。
          </Text>
          <Text size="small">
            单次上限：搜索 {config.limits.maxSearchCalls} 次 · 读取{" "}
            {config.limits.maxReads} 页 · 模型 {config.limits.maxLlmCalls} 次 ·{" "}
            {config.limits.runTimeoutMs / 1000} 秒。可随时中止，已取得的结果会保留。
          </Text>
          {config.mode === "live" && config.recipients.length > 0 && (
            <Text size="small">
              开始后会发送给：
              {config.recipients.map((r) => `${r.name}（${r.receives}）`).join("；")}
              。不会附带你的探索主题、理由或笔记。
            </Text>
          )}
        </Stack>
      )}

      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        {running ? (
          <Button leadingVisual={StopIcon} onClick={cancel}>
            中止
          </Button>
        ) : (
          <Button onClick={start} disabled={!canStart}>
            {run ? "重新补查" : "开始补查"}
          </Button>
        )}
        {config?.ready && !query.trim() && !run && (
          <Text size="small">先在上方输入问题或关键词。</Text>
        )}
        {config?.mode === "live" && (
          <SendStateText state={sendState} cancelled={run?.status === "cancelled"} />
        )}
      </Stack>
      {actionError && (
        <Banner variant="critical" title="操作没有完成" description={actionError} />
      )}

      {run && <RunView run={run} pollError={pollError} synthetic={synthetic} />}
    </Stack>
  );
}

function SendStateText({ state, cancelled }: { state: SendState; cancelled: boolean }) {
  const text = {
    idle: "问题尚未发送",
    sending: "正在发送问题……",
    sent: cancelled
      ? "问题已发送；中止后不再发起新请求，已发出的请求可能仍被外部服务处理"
      : "问题已发送给上述服务",
    unknown: "发送状态未确认，问题可能已发送",
  }[state];
  return <Text size="small">{text}</Text>;
}

function RunView({
  run,
  pollError,
  synthetic,
}: { run: RunSnapshot; pollError: boolean; synthetic: boolean }) {
  return (
    <Stack gap="normal">
      <Text size="small">本次输入：{run.question}</Text>
      {pollError && run.status === "running" && (
        <Text size="small">暂时取不到最新进度，正在重试；已显示的结果保持不变。</Text>
      )}
      <Stack as="ol" gap="condensed" aria-label="运行步骤">
        {run.events.map((e) => (
          <StepRow key={e.id} event={e} />
        ))}
        {run.status === "running" && run.events.length === 0 && (
          <Stack as="li" direction="horizontal" gap="condensed" align="center">
            <Spinner size="small" srText="进行中" />
            <Text size="small">正在开始</Text>
          </Stack>
        )}
      </Stack>
      <StatusBanner run={run} />
      {run.outcomes.length > 0 ? (
        <Stack gap="spacious">
          <Heading as="h3" variant="small">
            {synthetic ? "整理结果（合成）" : "整理结果"}
          </Heading>
          {run.outcomes.map((o, i) => (
            <OutcomeItem key={`${o.kind}-${o.candidate.name}-${i}`} outcome={o} />
          ))}
        </Stack>
      ) : (
        run.status !== "running" && (
          <Text size="medium">
            这次没有整理出相关人物。这不代表不存在相关导师，可以换个问法、调整关键词，或直接到原站查找。
          </Text>
        )
      )}
    </Stack>
  );
}

function StatusBanner({ run }: { run: RunSnapshot }) {
  const failed = run.failures.length;
  const failedNote =
    failed > 0
      ? `${failed} 个步骤失败（见上方），对应来源仍是待查线索，可以打开原站或稍后重试。`
      : "";
  switch (run.status) {
    case "running":
      return null;
    case "completed":
      return (
        <Banner
          variant={failed > 0 ? "warning" : "success"}
          title={failed > 0 ? "部分完成" : "已完成"}
          description={
            failed > 0
              ? `${failedNote}其余结果可以正常使用。`
              : "计划内的来源都已读取和整理。"
          }
        />
      );
    case "cancelled":
      return (
        <Banner
          variant="info"
          title="已中止"
          description={`停止了后续搜索、读取和整理，保留已取得的 ${run.outcomes.length} 项结果；中止后返回的内容不会再写入。${failedNote}`}
        />
      );
    case "limit-reached":
      return (
        <Banner
          variant="info"
          title="达到本次上限"
          description={`${run.stopDetail ?? "已达到单次运行上限"}。已完成的部分可以正常使用，可以调整问题后再补查。${failedNote}`}
        />
      );
    case "failed":
      return (
        <Banner
          variant="critical"
          title="补查中断"
          description={`${run.error ?? "服务出错"}。已有资料和已保存的记录不受影响。`}
        />
      );
  }
}

function StepRow({ event }: { event: RunEvent }) {
  const icon =
    event.state === "running" ? (
      <Spinner size="small" srText="进行中" />
    ) : event.state === "ok" ? (
      <CheckIcon aria-label="完成" />
    ) : event.state === "failed" ? (
      <XIcon aria-label="失败" />
    ) : (
      <CircleSlashIcon aria-label="已停止" />
    );
  const detail = event.state === "running" ? "进行中" : (event.detail ?? "");
  return (
    <Stack as="li" direction="horizontal" gap="condensed" align="center">
      {icon}
      <Text size="small">
        {eventText(event)}
        {detail && `：${detail}`}
      </Text>
    </Stack>
  );
}
