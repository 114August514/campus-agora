import {
  Button,
  Details,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  Textarea,
} from "@primer/react";
import { type Column, DataTable } from "@primer/react/experimental";
import {
  type ComparisonPerspective,
  type ResearchFocus,
  buildComparisonRows,
  buildResearchFocusHints,
} from "../lib/advisor-comparison";
import type { Advisor } from "../lib/advisors";
import type { SourceSnapshot } from "../lib/exploration-store";
import { SourceView } from "./SourceView";

export interface ComparisonNotes {
  reason: string;
  questions: string;
}

interface ComparisonItem {
  id: string;
  advisor: Advisor;
  criterion: string;
  text: string;
  sources: SourceSnapshot[];
}

export function AdvisorComparison({
  candidates,
  perspective,
  focus,
  topicName,
  notes,
  supplementalSources,
  onFollowup,
  onPerspectiveChange,
  onFocusChange,
  onRemove,
  onReturn,
  onNotesChange,
  onSave,
}: {
  candidates: Advisor[];
  perspective: ComparisonPerspective;
  focus: ResearchFocus;
  topicName?: string;
  notes: Record<string, ComparisonNotes>;
  supplementalSources: Record<string, SourceSnapshot[]>;
  onFollowup: (advisor: Advisor) => void;
  onPerspectiveChange: (value: ComparisonPerspective) => void;
  onFocusChange: (value: ResearchFocus) => void;
  onRemove: (candidateId: string) => void;
  onReturn: () => void;
  onNotesChange: (candidateId: string, value: ComparisonNotes) => void;
  onSave: (advisor: Advisor, notes: ComparisonNotes) => void;
}) {
  const rows = buildComparisonRows(candidates, perspective);
  const hints = buildResearchFocusHints(candidates, focus);
  const columns: Column<ComparisonItem>[] = [
    {
      id: "candidate",
      header: "候选",
      rowHeader: true,
      width: 96,
      renderCell: ({ advisor }) => (
        <Stack gap="condensed">
          <Text weight="semibold">{advisor.name}</Text>
          <Text size="small">{advisor.institution}</Text>
        </Stack>
      ),
    },
    {
      id: "answer",
      header: "已知信息与待确认项",
      width: "growCollapse",
      renderCell: (item) => (
        <Stack gap="condensed">
          <Text as="p">{item.text}</Text>
          {item.criterion === "还有哪些未知" && (
            <Button onClick={() => onFollowup(item.advisor)}>
              补查{item.advisor.name}
            </Button>
          )}
          {item.sources.length > 0 && (
            <Details>
              <Details.Summary
                aria-label={`查看${item.advisor.name}「${item.criterion}」的依据`}
              >
                查看依据（{item.sources.length}）
              </Details.Summary>
              <Stack gap="normal">
                {item.sources.map((source) => (
                  <SourceView
                    key={`${source.url}-${source.collectedAt}`}
                    source={source}
                  />
                ))}
              </Stack>
            </Details>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack as="section" gap="spacious">
      <Stack gap="normal">
        <Heading as="h2" variant="small">
          候选比较
        </Heading>
        <Text as="p">
          这次比较复用2026年10月5日采集的整理摘要。招生年份和途径按来源分别说明，当前名额与实际指导体验仍待了解。
        </Text>
        <Stack direction="horizontal" wrap="wrap" align="center">
          <Button onClick={onReturn}>返回候选资料</Button>
          {candidates.map((candidate) => (
            <Button
              key={candidate.candidateId}
              variant="invisible"
              onClick={() => onRemove(candidate.candidateId)}
            >
              移除{candidate.name}的比较
            </Button>
          ))}
        </Stack>
      </Stack>

      {candidates.length === 0 ? (
        <Text as="p">还没有选择比较对象。返回候选资料，可以选一名或两名阅读。</Text>
      ) : (
        <>
          <Stack direction={{ narrow: "vertical", regular: "horizontal" }} gap="normal">
            <FormControl>
              <FormControl.Label>现在想了解什么</FormControl.Label>
              <Select
                value={perspective}
                onChange={(event) =>
                  onPerspectiveChange(event.target.value as ComparisonPerspective)
                }
              >
                <Select.Option value="research">研究内容</Select.Option>
                <Select.Option value="graduate">读研参与途径</Select.Option>
                <Select.Option value="short-term">本科科研、RA 或短访</Select.Option>
              </Select>
            </FormControl>
            <FormControl>
              <FormControl.Label>研究关注点（可不选）</FormControl.Label>
              <Select
                value={focus}
                onChange={(event) => onFocusChange(event.target.value as ResearchFocus)}
              >
                <Select.Option value="open">暂未明确</Select.Option>
                <Select.Option value="software">软件可靠性与安全</Select.Option>
                <Select.Option value="ai-systems">AI 系统与 GPU 优化</Select.Option>
              </Select>
            </FormControl>
          </Stack>
          {candidates.length === 1 && (
            <Text as="p">当前只看一名候选；也可以返回资料加入另一名。</Text>
          )}
          {rows.map((row) => (
            <Stack as="section" key={row.id} gap="normal">
              <Heading as="h3" variant="small" id={`comparison-${row.id}`}>
                {row.label}
              </Heading>
              <DataTable
                aria-labelledby={`comparison-${row.id}`}
                columns={columns}
                data={row.cells.flatMap((cell) => {
                  const candidate = candidates.find(
                    (item) => item.candidateId === cell.candidateId,
                  );
                  return candidate
                    ? [
                        {
                          ...cell,
                          id: cell.candidateId,
                          advisor: candidate,
                          criterion: row.label,
                        },
                      ]
                    : [];
                })}
              />
            </Stack>
          ))}
          {hints.length > 0 && (
            <Stack as="section" gap="normal">
              <Heading as="h3" variant="small">
                按关注点继续了解
              </Heading>
              <Text as="p">
                以下是按已整理资料给出的阅读建议，可以更换关注点，也可以到此结束。
              </Text>
              {hints.map((hint) => {
                const candidate = candidates.find(
                  (item) => item.candidateId === hint.candidateId,
                );
                return (
                  <Stack key={hint.candidateId} gap="condensed">
                    <Text as="p">
                      <Text weight="semibold">{candidate?.name}：</Text>
                      {hint.text}
                    </Text>
                    <Details>
                      <Details.Summary>阅读建议的依据</Details.Summary>
                      <Stack gap="normal">
                        {hint.sources.map((source) => (
                          <SourceView
                            key={`${source.url}-${source.collectedAt}`}
                            source={source}
                          />
                        ))}
                      </Stack>
                    </Details>
                  </Stack>
                );
              })}
            </Stack>
          )}
          <Stack as="section" gap="normal">
            <Heading as="h3" variant="small">
              补充依据
            </Heading>
            <Text as="p">
              {topicName
                ? `以下是你关联到“${topicName}”的新增来源，可结合原有摘要继续判断；保存来源不代表待问项已确认。`
                : "补查后可以把来源保存到一个主题，再回到这里继续比较。"}
            </Text>
            {candidates.map((candidate) => {
              const sources = supplementalSources[candidate.candidateId] ?? [];
              return (
                <Stack key={candidate.candidateId} gap="condensed">
                  <Text weight="semibold">{candidate.name}</Text>
                  {sources.length ? (
                    <Details>
                      <Details.Summary>
                        查看{candidate.name}的补充依据（{sources.length}）
                      </Details.Summary>
                      <Stack gap="normal">
                        {sources.map((source, index) => (
                          <SourceView
                            key={`${source.url}-${source.collectedAt}-${index}`}
                            source={source}
                            saved
                          />
                        ))}
                      </Stack>
                    </Details>
                  ) : (
                    <Text as="p">当前主题还没有这位候选的补充依据。</Text>
                  )}
                  <Button onClick={() => onFollowup(candidate)}>
                    继续补查{candidate.name}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
          <Stack as="section" gap="normal">
            <Heading as="h3" variant="small">
              自己的记录
            </Heading>
            <Text as="p">
              {topicName
                ? `主动保存后，记录留在“${topicName}”中；不同主题各自记录，移除比较对象不会删除收藏。未保存的编辑刷新后会丢失。`
                : "如需记录理由或疑问，先选择或创建主题。比较本身不需要主题。"}
            </Text>
            {candidates.map((candidate) => {
              const draft = notes[candidate.candidateId] ?? {
                reason: "",
                questions: "",
              };
              return (
                <Stack key={candidate.candidateId} gap="normal">
                  <FormControl>
                    <FormControl.Label>
                      {candidate.name}：自己的理由（可不填）
                    </FormControl.Label>
                    <Textarea
                      block
                      disabled={!topicName}
                      value={draft.reason}
                      rows={2}
                      onChange={(event) =>
                        onNotesChange(candidate.candidateId, {
                          ...draft,
                          reason: event.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormControl.Label>
                      {candidate.name}：待问问题（一行一个，可不填）
                    </FormControl.Label>
                    <Textarea
                      block
                      disabled={!topicName}
                      value={draft.questions}
                      rows={2}
                      onChange={(event) =>
                        onNotesChange(candidate.candidateId, {
                          ...draft,
                          questions: event.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <Button
                    disabled={!topicName}
                    onClick={() => onSave(candidate, draft)}
                  >
                    保存{candidate.name}比较记录
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );
}
