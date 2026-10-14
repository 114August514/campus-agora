import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckIcon,
  LinkExternalIcon,
  PlusIcon,
} from "@primer/octicons-react";
import {
  Button,
  Details,
  Heading,
  Link,
  LinkButton,
  PageLayout,
  Stack,
  Text,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { href } from "../../app/router";
import { SaveDialog } from "../../components/SaveDialog";
import { RouteStatusLabel, SourceLink, SourceLinks } from "../../components/labels";
import { findAdvisor, suggestedQuestions } from "../../data/advisors";
import { toggleCompare, useCompare } from "../../state/compare";
import { useTopics } from "../../state/topics";

export function AdvisorPage({ id }: { id: string }) {
  const advisor = findAdvisor(id);
  const compare = useCompare();
  const topics = useTopics();
  const [saving, setSaving] = useState(false);

  if (!advisor) {
    return (
      <Blankslate>
        <Blankslate.Heading>没有找到这位候选</Blankslate.Heading>
        <Blankslate.PrimaryAction href={href({ page: "find" })}>
          返回找导师
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  const inCompare = compare.includes(advisor.id);
  const savedIn = topics.filter((t) =>
    t.entries.some((e) => e.item.kind === "advisor" && e.item.id === advisor.id),
  );
  const original = advisor.sources[0];

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Link href={href({ page: "find" })}>
          <Stack as="span" direction="horizontal" gap="tight" align="center">
            <ArrowLeftIcon />
            返回结果
          </Stack>
        </Link>
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="normal"
          align={{ narrow: "stretch", regular: "center" }}
          justify="space-between"
        >
          <Stack gap="tight">
            <Heading as="h1">{advisor.name}</Heading>
            <Text size="medium">
              {advisor.affiliation} · {advisor.region}
            </Text>
          </Stack>
          <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
            {original && (
              <LinkButton
                href={original.url}
                target="_blank"
                rel="noreferrer"
                trailingVisual={LinkExternalIcon}
              >
                打开原站
              </LinkButton>
            )}
            <Button leadingVisual={BookmarkIcon} onClick={() => setSaving(true)}>
              保存到探索
            </Button>
            <Button
              leadingVisual={inCompare ? CheckIcon : PlusIcon}
              aria-pressed={inCompare}
              onClick={() => toggleCompare(advisor.id)}
            >
              {inCompare ? "已加入比较" : "加入比较"}
            </Button>
            {inCompare && compare.length >= 2 && (
              <LinkButton href={href({ page: "compare" })} variant="invisible">
                查看比较
              </LinkButton>
            )}
          </Stack>
        </Stack>
        {savedIn.length > 0 && (
          <Text size="small">
            已保存在：
            {savedIn.map((t, i) => (
              <span key={t.id}>
                {i > 0 && "、"}
                <Link href={href({ page: "topic", id: t.id })}>{t.title}</Link>
              </span>
            ))}
          </Text>
        )}
      </Stack>

      <PageLayout padding="none" columnGap="normal" rowGap="normal">
        <PageLayout.Content as="div">
          <Stack gap="spacious">
            <Stack as="section" gap="normal" aria-labelledby="sec-research">
              <Heading as="h2" variant="medium" id="sec-research">
                研究什么
              </Heading>
              <Text size="large">{advisor.question}</Text>
              <Stack gap="condensed">
                <Heading as="h3" variant="small">
                  {advisor.work.title}
                </Heading>
                <Text size="medium">{advisor.work.explanation}</Text>
                <Text size="small">{advisor.work.authorshipNote}</Text>
                <SourceLinks sources={advisor.work.links} />
              </Stack>
            </Stack>

            <Stack as="section" gap="normal" aria-labelledby="sec-routes">
              <Heading as="h2" variant="medium" id="sec-routes">
                参与途径
              </Heading>
              {advisor.routes.length === 0 && (
                <Text size="medium">{advisor.routeGap}</Text>
              )}
              {advisor.routes.map((r) => (
                <Stack key={r.id} gap="condensed" paddingBlock="condensed">
                  <Stack
                    direction="horizontal"
                    gap="condensed"
                    align="center"
                    wrap="wrap"
                  >
                    <Heading as="h3" variant="small">
                      {r.title}
                    </Heading>
                    <RouteStatusLabel status={r.status} />
                  </Stack>
                  <Text size="medium">{r.basis}</Text>
                  {r.applicability && (
                    <Text size="medium">适用范围：{r.applicability}</Text>
                  )}
                  <Text size="medium">仍需确认：{r.pending}</Text>
                  {r.entry && <SourceLink source={r.entry} />}
                </Stack>
              ))}
            </Stack>

            <Stack as="section" gap="normal" aria-labelledby="sec-experience">
              <Heading as="h2" variant="medium" id="sec-experience">
                指导与实际经历
              </Heading>
              <Text size="medium">{advisor.experience.known}</Text>
              {advisor.experience.links.length > 0 && (
                <SourceLinks sources={advisor.experience.links} />
              )}
              <Stack gap="tight">
                <Text size="medium" weight="semibold">
                  仍未知：{advisor.unknowns.join("、")}
                </Text>
                <Text size="small">缺少公开经历不是差评。</Text>
              </Stack>
              <Details>
                <Details.Summary>
                  <Text size="medium">需要交流时，可以问什么</Text>
                </Details.Summary>
                <Stack gap="condensed" paddingBlock="normal">
                  {suggestedQuestions.map((question) => (
                    <Text key={question} size="medium">
                      {question}
                    </Text>
                  ))}
                </Stack>
              </Details>
            </Stack>
          </Stack>
        </PageLayout.Content>
        <PageLayout.Pane position="end" width="medium" aria-label="来源与可选准备">
          <Stack gap="spacious">
            <Stack as="section" gap="normal" aria-labelledby="sec-sources">
              <Heading as="h2" variant="small" id="sec-sources">
                来源与时间
              </Heading>
              <SourceLinks sources={advisor.sources} />
              {advisor.sourceNotes.map((n) => (
                <Text key={n} size="small">
                  {n}
                </Text>
              ))}
              <Text size="small">
                查看日期记录读取时间，当前名额与条件仍需向原站确认。
              </Text>
            </Stack>
            <Stack as="section" gap="normal" aria-labelledby="sec-prep">
              <Heading as="h2" variant="small" id="sec-prep">
                可选准备
              </Heading>
              <Text size="medium">{advisor.preparation}</Text>
              <Link href={href({ page: "opportunities", type: "support" })}>
                查看资源与支持
              </Link>
            </Stack>
          </Stack>
        </PageLayout.Pane>
      </PageLayout>

      {saving && (
        <SaveDialog
          item={{ kind: "advisor", id: advisor.id }}
          name={advisor.name}
          onClose={() => setSaving(false)}
        />
      )}
    </Stack>
  );
}
