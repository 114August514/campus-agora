import {
  ArrowRightIcon,
  LinkExternalIcon,
  SearchIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  Button,
  CounterLabel,
  FormControl,
  Heading,
  Link,
  LinkButton,
  PageLayout,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { href, navigate } from "../../app/router";
import { FIXED_DATA_AS_OF, advisors } from "../../data/advisors";
import { describeItem } from "../../data/items";
import {
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../../data/opportunities";
import type { ItemRef, OpportunityType } from "../../data/types";
import { useTopics } from "../../state/topics";
import { useSessionState } from "../../state/useSessionState";
import { matchesAdvisor } from "../find/FindPage";
import { matchesOpportunity } from "../opportunities/OpportunitiesPage";

function typeSummary(type: OpportunityType): string {
  const ended = opportunities.filter(
    (o) => o.types.includes(type) && o.timing === "historical",
  ).length;
  return ended > 0 ? `含 ${ended} 项已结束批次的历史参考` : "入口与适用条件";
}

function ResultRow({ item }: { item: ItemRef }) {
  const view = describeItem(item);
  if (!view) return null;
  return (
    <Stack as="article" gap="condensed" paddingBlock="normal">
      <Heading as="h3" variant="small">
        <Link
          href={view.link.href}
          {...(view.link.external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {view.title}{" "}
          {view.link.external && <LinkExternalIcon aria-label="在新窗口打开原站" />}
        </Link>
      </Heading>
      <Text size="small">{view.meta}</Text>
      <Text size="medium">{view.summary}</Text>
    </Stack>
  );
}

export function HomePage() {
  const [query, setQuery] = useSessionState("home.query", "");
  const topics = useTopics();
  const q = query.trim();
  const foundAdvisors = q ? advisors.filter((a) => matchesAdvisor(a, q)) : [];
  const foundOpportunities = q
    ? opportunities.filter((o) => matchesOpportunity(o, q))
    : [];
  const totalFound = foundAdvisors.length + foundOpportunities.length;
  const carryAdvisorQuery = () => {
    try {
      window.sessionStorage.setItem("find.query", JSON.stringify(q));
    } catch {
      // The destination remains usable when the browser cannot retain the query.
    }
  };

  return (
    <PageLayout padding="none" columnGap="normal" rowGap="normal">
      <PageLayout.Header>
        <Stack gap="normal" paddingBlock="normal">
          <Heading as="h1">探索机会</Heading>
          <FormControl>
            <FormControl.Label>搜索导师、机会、资源或规则</FormControl.Label>
            <TextInput
              leadingVisual={SearchIcon}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="导师、研究问题、竞赛、暑校、算力……"
              size="large"
              block
            />
            <FormControl.Caption>
              搜索当前收录的资料；找导师时可以进一步补查外部来源。
            </FormControl.Caption>
          </FormControl>
        </Stack>
      </PageLayout.Header>

      <PageLayout.Content as="section" aria-label={q ? "搜索结果" : "导师与探索主题"}>
        <Stack gap="spacious">
          {q ? (
            <Stack as="section" gap="normal" aria-labelledby="home-results">
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                gap="normal"
              >
                <Stack direction="horizontal" align="center" gap="condensed">
                  <Heading as="h2" variant="medium" id="home-results">
                    搜索结果
                  </Heading>
                  <CounterLabel>{totalFound}</CounterLabel>
                </Stack>
                <Button
                  size="small"
                  variant="invisible"
                  leadingVisual={XIcon}
                  onClick={() => setQuery("")}
                >
                  清除搜索
                </Button>
              </Stack>
              <Text as="output" size="small">
                当前收录中找到 {totalFound} 项与“{q}”相关的资料。
              </Text>
              {totalFound === 0 ? (
                <Blankslate>
                  <Blankslate.Heading>当前收录中未找到</Blankslate.Heading>
                  <Blankslate.Description>
                    可以换个关键词；导师信息还可以补查外部来源。
                  </Blankslate.Description>
                  <Blankslate.PrimaryAction
                    onClick={() => {
                      carryAdvisorQuery();
                      navigate({ page: "find" });
                    }}
                  >
                    去找导师补查
                  </Blankslate.PrimaryAction>
                </Blankslate>
              ) : (
                <>
                  {foundAdvisors.map((a) => (
                    <ResultRow key={a.id} item={{ kind: "advisor", id: a.id }} />
                  ))}
                  {foundOpportunities.map((o) => (
                    <ResultRow key={o.id} item={{ kind: "opportunity", id: o.id }} />
                  ))}
                </>
              )}
            </Stack>
          ) : (
            <>
              {topics.length > 0 && (
                <Stack as="section" gap="normal" aria-labelledby="home-topics">
                  <Stack
                    direction="horizontal"
                    justify="space-between"
                    align="center"
                    gap="normal"
                  >
                    <Heading as="h2" variant="medium" id="home-topics">
                      继续上次的探索
                    </Heading>
                    <Link href={href({ page: "topics" })}>全部主题</Link>
                  </Stack>
                  <ActionList variant="full" aria-label="最近创建的探索主题">
                    {topics
                      .slice(-3)
                      .reverse()
                      .map((topic) => (
                        <ActionList.LinkItem
                          key={topic.id}
                          href={href({ page: "topic", id: topic.id })}
                        >
                          {topic.title}
                          <ActionList.Description variant="block">
                            {topic.question || `${topic.entries.length} 项已保存内容`}
                          </ActionList.Description>
                        </ActionList.LinkItem>
                      ))}
                  </ActionList>
                </Stack>
              )}
              <Stack as="section" gap="normal" aria-labelledby="home-advisors">
                <Stack
                  direction="horizontal"
                  justify="space-between"
                  align="center"
                  gap="normal"
                >
                  <Heading as="h2" variant="medium" id="home-advisors">
                    导师探索
                  </Heading>
                  <LinkButton
                    href={href({ page: "find" })}
                    size="small"
                    variant="invisible"
                    trailingVisual={ArrowRightIcon}
                  >
                    查找与比较
                  </LinkButton>
                </Stack>
                <Text size="small">
                  已有 {advisors.length} 位导师的研究与参与途径资料 · {FIXED_DATA_AS_OF}{" "}
                  整理
                </Text>
                <Stack gap="condensed">
                  {advisors.map((a) => (
                    <ResultRow key={a.id} item={{ kind: "advisor", id: a.id }} />
                  ))}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </PageLayout.Content>

      <PageLayout.Pane
        position="end"
        width="small"
        divider="none"
        aria-label="分类入口"
      >
        <Stack as="section" gap="normal" aria-labelledby="home-types">
          <Heading as="h2" variant="medium" id="home-types">
            按类型浏览
          </Heading>
          <ActionList variant="full" aria-label="机会与资源类型">
            {opportunityTypes.map((type) => (
              <ActionList.LinkItem
                key={type}
                href={href({ page: "opportunities", type })}
              >
                {opportunityTypeText[type]}
                <ActionList.TrailingVisual>
                  <CounterLabel>
                    {opportunities.filter((o) => o.types.includes(type)).length}
                  </CounterLabel>
                </ActionList.TrailingVisual>
                <ActionList.Description variant="block">
                  {typeSummary(type)}
                </ActionList.Description>
              </ActionList.LinkItem>
            ))}
          </ActionList>
          <Text size="small">
            这些分类目前提供入口与条件查询。导师比较与外部补查在“找导师”中使用。
          </Text>
        </Stack>
      </PageLayout.Pane>
    </PageLayout>
  );
}
