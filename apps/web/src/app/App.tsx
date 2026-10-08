import { BookmarkIcon } from "@primer/octicons-react";
import {
  ActionList,
  Banner,
  Button,
  FormControl,
  Heading,
  PageLayout,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  UnderlineNav,
} from "@primer/react";
import { useState } from "react";
import {
  AdvisorComparison,
  type ComparisonNotes,
} from "../components/AdvisorComparison";
import { DiscoveryPanel } from "../components/DiscoveryPanel";
import { SourceView } from "../components/SourceView";
import {
  type ComparisonPerspective,
  type ResearchFocus,
  comparisonSupportedCandidateIds,
} from "../lib/advisor-comparison";
import { type Advisor, advisors, collectedBatches, sourceDate } from "../lib/advisors";
import { getFollowupQuery, getSupplementalSources } from "../lib/comparison-followup";
import {
  type CandidateSnapshot,
  type ExplorationTopic,
  createExplorationStore,
} from "../lib/exploration-store";

function loadExplorations() {
  try {
    const store = createExplorationStore(window.localStorage);
    return { store, topics: store.listTopics(), error: "" };
  } catch (error) {
    return {
      store: null,
      topics: [] as ExplorationTopic[],
      error: `本地保存不可用：${error instanceof Error ? error.message : "无法读取浏览器资料"}。仍可以浏览和查找。`,
    };
  }
}

export function App() {
  const [initial] = useState(loadExplorations);
  const [topics, setTopics] = useState(initial.topics);
  const [topicId, setTopicId] = useState(initial.topics[0]?.id ?? "");
  const [view, setView] = useState<"explore" | "saved" | "compare" | "followup">(
    "explore",
  );
  const [followupCandidate, setFollowupCandidate] = useState<Advisor>();
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [perspective, setPerspective] = useState<ComparisonPerspective>("research");
  const [focus, setFocus] = useState<ResearchFocus>("open");
  const [comparisonDrafts, setComparisonDrafts] = useState<
    Record<string, ComparisonNotes>
  >({});
  const [query, setQuery] = useState("AI systems compiler Tianqi Chen");
  const [selectedAdvisor, setSelectedAdvisor] = useState("tianqi-chen");
  const [topicName, setTopicName] = useState("");
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const activeTopic = topics.find((topic) => topic.id === topicId);
  const advisor = advisors.find((item) => item.candidateId === selectedAdvisor);
  const comparisonCandidates = comparisonIds.flatMap((id) => {
    const candidate = advisors.find((item) => item.candidateId === id);
    return candidate ? [candidate] : [];
  });
  const comparisonNotes = Object.fromEntries(
    comparisonCandidates.map((candidate) => {
      const saved = activeTopic?.candidates.find(
        (item) => item.candidate.candidateId === candidate.candidateId,
      );
      return [
        candidate.candidateId,
        comparisonDrafts[`${topicId}:${candidate.candidateId}`] ?? {
          reason: saved?.reason ?? "",
          questions: saved?.questions.join("\n") ?? "",
        },
      ];
    }),
  );
  const latestCollection = collectedBatches.reduce((latest, batch) =>
    Date.parse(batch.completedAt) > Date.parse(latest.completedAt) ? batch : latest,
  );

  function mutate(action: () => void) {
    setError("");
    setMessage("");
    try {
      if (!initial.store)
        throw new Error("浏览器保存不可用，无法保存；当前浏览结果仍保留。");
      action();
      setTopics(initial.store.listTopics());
    } catch (failure) {
      setMessage("");
      setError(failure instanceof Error ? failure.message : "未能保存，请重试。");
    }
  }

  function clearComparisonDrafts(id: string, candidateId?: string) {
    setComparisonDrafts((drafts) => {
      const updated = { ...drafts };
      if (candidateId !== undefined) {
        delete updated[`${id}:${candidateId}`];
      } else {
        for (const key of Object.keys(updated)) {
          if (key.startsWith(`${id}:`)) delete updated[key];
        }
      }
      return updated;
    });
  }

  function save(candidate: CandidateSnapshot, reason = "", questions: string[] = []) {
    mutate(() => {
      if (!activeTopic)
        throw new Error("先选择或创建一个探索主题；浏览不要求创建主题。");
      initial.store?.saveCandidate(activeTopic.id, candidate, { reason, questions });
      clearComparisonDrafts(activeTopic.id, candidate.candidateId);
      setMessage(`已保存到“${activeTopic.name}”。已有的私人理由和疑问会保留。`);
    });
  }

  function saveComparison(candidate: Advisor, notes: ComparisonNotes) {
    mutate(() => {
      if (!activeTopic) throw new Error("先选择或创建一个主题，再保存比较记录。");
      const questions = notes.questions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      initial.store?.saveCandidate(activeTopic.id, candidate, {
        reason: notes.reason,
        questions,
      });
      if (
        activeTopic.candidates.some(
          (record) => record.candidate.candidateId === candidate.candidateId,
        )
      ) {
        initial.store?.updateCandidate(activeTopic.id, candidate.candidateId, {
          reason: notes.reason,
          questions,
        });
      }
      clearComparisonDrafts(activeTopic.id, candidate.candidateId);
      setMessage(`已保存${candidate.name}的比较记录到“${activeTopic.name}”。`);
    });
  }

  function startFollowup(candidate: Advisor) {
    setFollowupCandidate(candidate);
    setQuery(getFollowupQuery(candidate, perspective));
    setError("");
    setMessage("");
    setView("followup");
  }

  function saveSupplemental(candidate: CandidateSnapshot) {
    mutate(() => {
      if (!activeTopic) throw new Error("先选择或创建主题，再保存补充依据。");
      initial.store?.saveCandidate(activeTopic.id, candidate);
      // Adding evidence does not save or discard the comparison's private drafts.
      setMessage(
        `已把${candidate.name}的补充依据保存到“${activeTopic.name}”，可返回比较继续查看。`,
      );
    });
  }

  return (
    <PageLayout containerWidth="large" padding="normal">
      <PageLayout.Header>
        <Stack gap="condensed">
          <Heading as="h1" variant="medium">
            选导师
          </Heading>
          <UnderlineNav aria-label="主导航" variant="flush">
            <UnderlineNav.Item
              aria-current={view === "explore" ? "page" : undefined}
              onSelect={(event) => {
                event.preventDefault();
                setView("explore");
              }}
            >
              探索
            </UnderlineNav.Item>
            <UnderlineNav.Item
              counter={comparisonIds.length}
              aria-current={
                view === "compare" || view === "followup" ? "page" : undefined
              }
              onSelect={(event) => {
                event.preventDefault();
                setView("compare");
              }}
            >
              比较
            </UnderlineNav.Item>
            <UnderlineNav.Item
              counter={topics.length}
              aria-current={view === "saved" ? "page" : undefined}
              onSelect={(event) => {
                event.preventDefault();
                setView("saved");
              }}
            >
              我的探索
            </UnderlineNav.Item>
          </UnderlineNav>
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content width="large">
        <Stack gap="normal">
          <div aria-live="polite">
            {message && <Banner variant="success" layout="compact" title={message} />}
            {error && <Banner variant="critical" layout="compact" title={error} />}
          </div>
          <Stack
            direction={{ narrow: "vertical", regular: "horizontal" }}
            gap="normal"
            align="start"
          >
            <FormControl>
              <FormControl.Label>当前探索主题</FormControl.Label>
              <Select
                value={topicId}
                onChange={(event) => {
                  setTopicId(event.target.value);
                  setDeleteConfirm(false);
                  setMessage("");
                }}
              >
                <Select.Option value="">暂不保存</Select.Option>
                {topics.map((topic) => (
                  <Select.Option key={topic.id} value={topic.id}>
                    {topic.name}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                mutate(() => {
                  const created = initial.store?.createTopic({
                    name: topicName,
                    question:
                      view === "compare"
                        ? `了解${comparisonCandidates.map((item) => item.name).join("、") || "候选导师"}的${perspective === "research" ? "研究内容" : perspective === "graduate" ? "读研参与途径" : "本科科研、RA 或短访途径"}`
                        : query,
                  });
                  if (created) {
                    setTopicId(created.id);
                    setTopicName("");
                    setMessage(`已创建“${created.name}”。`);
                  }
                });
              }}
            >
              <Stack
                direction={{ narrow: "vertical", regular: "horizontal" }}
                align="end"
                gap="condensed"
              >
                <FormControl>
                  <FormControl.Label>新主题名称</FormControl.Label>
                  <TextInput
                    value={topicName}
                    onChange={(event) => setTopicName(event.target.value)}
                    placeholder="例如 暑期科研、长期导师"
                    maxLength={100}
                  />
                </FormControl>
                <Button type="submit" disabled={!topicName.trim() || !initial.store}>
                  创建主题
                </Button>
              </Stack>
            </form>
          </Stack>
          {view === "explore" ? (
            <>
              <DiscoveryPanel
                query={query}
                onQueryChange={setQuery}
                canSave={Boolean(activeTopic && initial.store)}
                onSave={save}
              />
              <Stack as="section" gap="normal">
                <Heading as="h2" variant="small">
                  已有候选资料
                </Heading>
                <Text as="p">
                  共{advisors.length}名候选，包含研究样稿与{collectedBatches.length}
                  次预采集资料；最近整理于{sourceDate(latestCollection.completedAt)}。
                  这里复用已保存的资料，不会实时重查。资料范围和仍待确认的信息见候选详情。
                </Text>
                <Stack direction="horizontal" wrap="wrap" align="center">
                  <Button
                    onClick={() => {
                      setComparisonIds([...comparisonSupportedCandidateIds]);
                      setView("compare");
                    }}
                  >
                    比较本次采集的两名候选
                  </Button>
                  <Button onClick={() => setView("compare")}>
                    查看当前比较（{comparisonIds.length}）
                  </Button>
                  {advisor &&
                    comparisonSupportedCandidateIds.some(
                      (id) => id === advisor.candidateId,
                    ) && (
                      <Button
                        aria-pressed={comparisonIds.includes(advisor.candidateId)}
                        onClick={() =>
                          setComparisonIds((ids) =>
                            ids.includes(advisor.candidateId)
                              ? ids.filter((id) => id !== advisor.candidateId)
                              : [...ids, advisor.candidateId],
                          )
                        }
                      >
                        {comparisonIds.includes(advisor.candidateId)
                          ? `取消比较${advisor.name}`
                          : `加入比较${advisor.name}`}
                      </Button>
                    )}
                </Stack>
                <ActionList showDividers selectionVariant="single">
                  {advisors.map((item) => (
                    <ActionList.Item
                      key={item.candidateId}
                      selected={selectedAdvisor === item.candidateId}
                      onSelect={() => setSelectedAdvisor(item.candidateId)}
                    >
                      {item.name}
                      <ActionList.Description variant="block">
                        {item.institution}。{item.research}
                      </ActionList.Description>
                    </ActionList.Item>
                  ))}
                </ActionList>
              </Stack>
              {advisor && (
                <AdvisorDetail
                  key={`${advisor.candidateId}-${topicId}`}
                  advisor={advisor}
                  topic={activeTopic}
                  onSave={save}
                />
              )}
            </>
          ) : view === "followup" && followupCandidate ? (
            <Stack as="section" gap="normal">
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                wrap="wrap"
              >
                <Heading as="h2" variant="small">
                  补查{followupCandidate.name}
                </Heading>
                <Button onClick={() => setView("compare")}>返回比较</Button>
              </Stack>
              <Text as="p">
                按当前比较视角预填了公开检索词，可以改成一个具体问题后再查找。
              </Text>
              <DiscoveryPanel
                key={followupCandidate.candidateId}
                query={query}
                onQueryChange={setQuery}
                canSave={Boolean(activeTopic && initial.store)}
                onSave={saveSupplemental}
                targetCandidate={followupCandidate}
                saveTargetName={activeTopic?.name}
              />
            </Stack>
          ) : view === "compare" ? (
            <AdvisorComparison
              candidates={comparisonCandidates}
              perspective={perspective}
              focus={focus}
              topicName={initial.store ? activeTopic?.name : undefined}
              notes={comparisonNotes}
              supplementalSources={Object.fromEntries(
                comparisonCandidates.map((candidate) => [
                  candidate.candidateId,
                  getSupplementalSources(candidate, activeTopic),
                ]),
              )}
              onFollowup={startFollowup}
              onPerspectiveChange={setPerspective}
              onFocusChange={setFocus}
              onRemove={(id) =>
                setComparisonIds((ids) => ids.filter((item) => item !== id))
              }
              onReturn={() => setView("explore")}
              onNotesChange={(id, notes) =>
                setComparisonDrafts((drafts) => ({
                  ...drafts,
                  [`${topicId}:${id}`]: notes,
                }))
              }
              onSave={saveComparison}
            />
          ) : (
            <Stack as="section" gap="normal">
              <Heading as="h2" variant="small">
                {activeTopic?.name ?? "我的探索"}
              </Heading>
              <Text as="p">
                保存在此浏览器，不跨设备同步。清除网站数据会移除记录；浏览和保存都不代表决定申请。
              </Text>
              {!activeTopic && (
                <Text as="p">选择一个主题查看，或返回探索继续浏览。</Text>
              )}
              {activeTopic && (
                <>
                  <Text as="p">创建时的问题：{activeTopic.question || "未填写"}</Text>
                  {activeTopic.candidates.length === 0 && (
                    <Text as="p">
                      还没有保存候选。可以回到探索，看见值得保留的内容时再保存。
                    </Text>
                  )}
                  {activeTopic.candidates.map((record) => (
                    <SavedCandidate
                      key={`${activeTopic.id}-${record.candidate.candidateId}`}
                      record={record}
                      onUpdate={(reason, questions) =>
                        mutate(() => {
                          initial.store?.updateCandidate(
                            activeTopic.id,
                            record.candidate.candidateId,
                            { reason, questions },
                          );
                          clearComparisonDrafts(
                            activeTopic.id,
                            record.candidate.candidateId,
                          );
                          setMessage("私人理由和疑问已保存。");
                        })
                      }
                      onRemove={() =>
                        mutate(() => {
                          initial.store?.removeCandidate(
                            activeTopic.id,
                            record.candidate.candidateId,
                          );
                          clearComparisonDrafts(
                            activeTopic.id,
                            record.candidate.candidateId,
                          );
                          setMessage("已从这个主题移除，其他主题不受影响。");
                        })
                      }
                    />
                  ))}
                  <Stack gap="condensed">
                    {deleteConfirm ? (
                      <>
                        <Text as="p">
                          删除“{activeTopic.name}”及其中的私人记录？其他主题不受影响。
                        </Text>
                        <Stack direction="horizontal" wrap="wrap">
                          <Button
                            variant="danger"
                            onClick={() =>
                              mutate(() => {
                                initial.store?.deleteTopic(activeTopic.id);
                                clearComparisonDrafts(activeTopic.id);
                                setTopicId("");
                                setDeleteConfirm(false);
                                setMessage("这个主题已删除。");
                              })
                            }
                          >
                            确认删除此主题
                          </Button>
                          <Button onClick={() => setDeleteConfirm(false)}>取消</Button>
                        </Stack>
                      </>
                    ) : (
                      <Button
                        variant="invisible"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        删除这个主题
                      </Button>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </PageLayout.Content>
      <PageLayout.Footer>
        <Text as="p" size="small">
          资料保存在此浏览器。浏览和保存不代表决定申请。
        </Text>
      </PageLayout.Footer>
    </PageLayout>
  );
}

function AdvisorDetail({
  advisor,
  topic,
  onSave,
}: {
  advisor: Advisor;
  topic?: ExplorationTopic;
  onSave: (candidate: CandidateSnapshot, reason: string, questions: string[]) => void;
}) {
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  return (
    <Stack as="section" gap="normal">
      <Heading as="h2" variant="small">
        {advisor.name}
      </Heading>
      <Text as="p">
        <Text weight="semibold">研究问题：</Text>
        {advisor.research}
      </Text>
      <Text as="p">{advisor.approach}</Text>
      <Text as="p">
        <Text weight="semibold">参与途径：</Text>
        {advisor.participation}
      </Text>
      <Text as="p">
        <Text weight="semibold">仍待了解：</Text>
        {advisor.unknowns}
      </Text>
      {advisor.sources.map((source, index) => (
        <SourceView
          key={`${source.url}-${source.collectedAt}-${index}`}
          source={source}
        />
      ))}
      <FormControl>
        <FormControl.Label>自己的理由（可不填）</FormControl.Label>
        <Textarea
          block
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>想进一步了解什么（可不填）</FormControl.Label>
        <TextInput
          block
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </FormControl>
      <Stack direction="horizontal" align="center" wrap="wrap">
        <Button
          leadingVisual={BookmarkIcon}
          disabled={!topic}
          onClick={() =>
            onSave(advisor, reason, question.trim() ? [question.trim()] : [])
          }
        >
          保存{advisor.name}到主题
        </Button>
        {!topic && <Text size="small">想保留时，再选择或创建主题。</Text>}
      </Stack>
    </Stack>
  );
}

function SavedCandidate({
  record,
  onUpdate,
  onRemove,
}: {
  record: ExplorationTopic["candidates"][number];
  onUpdate: (reason: string, questions: string[]) => void;
  onRemove: () => void;
}) {
  const [reason, setReason] = useState(record.reason);
  const [question, setQuestion] = useState(record.questions.join("\n"));
  return (
    <Stack as="section" gap="normal">
      <Heading as="h3" variant="small">
        {record.candidate.name} · {record.candidate.institution}
      </Heading>
      <Text as="p">{record.candidate.research}</Text>
      {record.candidate.sources.map((source, index) => (
        <SourceView
          key={`${source.url}-${source.collectedAt}-${index}`}
          source={source}
          saved
        />
      ))}
      <FormControl>
        <FormControl.Label>私人理由</FormControl.Label>
        <Textarea
          block
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>待问问题（一行一个）</FormControl.Label>
        <Textarea
          block
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
        />
      </FormControl>
      <Stack direction="horizontal" wrap="wrap">
        <Button
          onClick={() =>
            onUpdate(
              reason,
              question
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        >
          保存记录
        </Button>
        <Button variant="invisible" onClick={onRemove}>
          从此主题移除候选
        </Button>
      </Stack>
    </Stack>
  );
}
