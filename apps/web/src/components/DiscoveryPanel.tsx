import { type DiscoveryResponse, discoverSources } from "@campus-agora/api-client";
import { SearchIcon } from "@primer/octicons-react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useRef, useState } from "react";
import { type Advisor, advisors } from "../lib/advisors";
import type { CandidateSnapshot, SourceSnapshot } from "../lib/exploration-store";
import { SourceView } from "./SourceView";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSave: (candidate: CandidateSnapshot) => void;
  canSave: boolean;
  targetCandidate?: Advisor;
  saveTargetName?: string;
}

export function DiscoveryPanel({
  query,
  onQueryChange,
  onSave,
  canSave,
  targetCandidate,
  saveTargetName,
}: Props) {
  const [result, setResult] = useState<DiscoveryResponse | null>(null);
  const [runningQuery, setRunningQuery] = useState("");
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [institution, setInstitution] = useState("");
  const [research, setResearch] = useState("");
  const sequence = useRef(0);
  const hasCandidate = targetCandidate
    ? true
    : candidateId === "new"
      ? Boolean(candidateName.trim() && institution.trim())
      : Boolean(candidateId);

  async function search() {
    const input = query.trim();
    if (!input) return;
    const request = ++sequence.current;
    setRunningQuery(input);
    setError("");
    try {
      const response = await discoverSources(input);
      if (request === sequence.current) setResult(response);
    } catch (failure) {
      if (request === sequence.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "外部查找失败，可重试或继续查看已有资料。",
        );
    } finally {
      if (request === sequence.current) setRunningQuery("");
    }
  }

  return (
    <Stack gap="normal" as="section">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Stack gap="condensed">
          <FormControl>
            <FormControl.Label>想了解什么研究或哪位导师？</FormControl.Label>
            <TextInput
              block
              autoFocus={Boolean(targetCandidate)}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="例如 AI systems compiler Tianqi Chen"
            />
            <FormControl.Caption>
              查找内容会发送到DuckDuckGo，资料从原站读取。私人理由和疑问仅保存在此浏览器。
            </FormControl.Caption>
          </FormControl>
          <Stack direction="horizontal" align="center" wrap="wrap">
            <Button type="submit" leadingVisual={SearchIcon} disabled={!query.trim()}>
              {runningQuery ? "按当前内容重新查找" : "查找外部资料"}
            </Button>
            <Text size="small">已有资料也可以直接阅读。</Text>
          </Stack>
        </Stack>
      </form>
      <div aria-live="polite">
        {runningQuery && (
          <Banner
            variant="info"
            layout="compact"
            title={`正在检索并读取公开来源：${runningQuery}`}
          />
        )}
        {error && (
          <Banner
            variant="critical"
            layout="compact"
            title={`${error} 已有资料和已保存主题仍可查看。`}
          />
        )}
      </div>
      {result && (
        <Stack gap="normal">
          <Heading as="h2" variant="small">
            本次外部资料
          </Heading>
          <Text as="p">
            这组结果对应“{result.query}”。{result.scope}
          </Text>
          {query.trim() !== result.query && (
            <Text as="p">查找内容已修改；下面仍是上次条件的结果，可重新查找。</Text>
          )}
          {result.sources.length === 0 && (
            <Text as="p">
              没有取得可展示的相关正文。可以换关键词，或先查看已有资料；这不代表没有相关导师。
            </Text>
          )}
          {result.warnings.map((warning, index) => (
            <Banner
              key={`${warning.code}-${index}`}
              variant="warning"
              layout="compact"
              title={warning.message}
            />
          ))}
          {result.sources.length > 0 && targetCandidate && (
            <Text as="p">
              请核对来源是否与{targetCandidate.name}（{targetCandidate.institution}）
              有关，再确认保存。
              {saveTargetName
                ? `将保存到“${saveTargetName}”。`
                : "如需保存，可先选择或创建主题。"}
            </Text>
          )}
          {result.sources.length > 0 && !targetCandidate && (
            <FormControl>
              <FormControl.Label>需要保存时，将依据关联到哪位候选？</FormControl.Label>
              <Select
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
              >
                <Select.Option value="">选择候选</Select.Option>
                <Select.Option value="new">新候选（自行填写）</Select.Option>
                {advisors.map((advisor) => (
                  <Select.Option key={advisor.candidateId} value={advisor.candidateId}>
                    {advisor.name}
                  </Select.Option>
                ))}
              </Select>
              <FormControl.Caption>
                由你判断关系；学校目录或论文共同作者不自动认作实际指导人。
              </FormControl.Caption>
            </FormControl>
          )}
          {result.sources.length > 0 && !targetCandidate && candidateId === "new" && (
            <Stack gap="condensed">
              <FormControl required>
                <FormControl.Label>导师姓名</FormControl.Label>
                <TextInput
                  block
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                  maxLength={100}
                />
              </FormControl>
              <FormControl required>
                <FormControl.Label>所属机构</FormControl.Label>
                <TextInput
                  block
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                  maxLength={200}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>研究方向（可不填）</FormControl.Label>
                <TextInput
                  block
                  value={research}
                  onChange={(event) => setResearch(event.target.value)}
                  maxLength={500}
                />
                <FormControl.Caption>
                  按已读依据填写；目录中的人和论文作者未必是招生导师。
                </FormControl.Caption>
              </FormControl>
            </Stack>
          )}
          {result.sources.map((source) => {
            const snapshot: SourceSnapshot = {
              url: source.url,
              title: source.title,
              content: source.content,
              collectedAt: source.collectedAt,
              kind: "live",
              publishedAt: source.publishedAt,
              query: result.query,
              relevanceEvidence: source.relevanceEvidence,
              unknowns: source.unknowns,
            };
            return (
              <Stack key={source.url} gap="condensed" as="section">
                <SourceView source={snapshot} />
                <Button
                  disabled={!canSave || !hasCandidate}
                  onClick={() => {
                    const candidate =
                      targetCandidate ??
                      (candidateId === "new"
                        ? {
                            candidateId: `external:${institution.trim()}:${candidateName.trim()}`,
                            name: candidateName.trim(),
                            institution: institution.trim(),
                            research: research.trim(),
                            sources: [],
                          }
                        : advisors.find(
                            (advisor) => advisor.candidateId === candidateId,
                          ));
                    if (candidate) onSave({ ...candidate, sources: [snapshot] });
                  }}
                >
                  {targetCandidate
                    ? `确认与${targetCandidate.name}相关并保存${saveTargetName ? `到“${saveTargetName}”` : ""}`
                    : "保存这条依据到当前主题"}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
