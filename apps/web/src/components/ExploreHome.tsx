// Product entry: one search across advisors and every opportunity type, then
// browsing by type. States plainly what each type supports today.
import { LinkExternalIcon } from "@primer/octicons-react";
import {
  ActionList,
  CounterLabel,
  FormControl,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useState } from "react";
import type { Advisor } from "../lib/advisors";
import {
  type OpportunityType,
  matchesOpportunity,
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";

export function matchesAdvisor(advisor: Advisor, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = [
    advisor.name,
    advisor.institution,
    advisor.research,
    advisor.approach,
    advisor.participation,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => text.includes(term));
}

function typeNote(type: OpportunityType): string {
  const ended = opportunities.filter(
    (item) => item.types.includes(type) && item.timing === "historical",
  ).length;
  return ended > 0 ? `入口与条件，含 ${ended} 项已结束批次的历史参考` : "入口与条件";
}

export function ExploreHome({
  advisors,
  onOpenAdvisors,
  onOpenAdvisor,
  onOpenType,
}: {
  advisors: Advisor[];
  onOpenAdvisors: () => void;
  onOpenAdvisor: (candidateId: string) => void;
  onOpenType: (type: OpportunityType) => void;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const foundAdvisors = searching
    ? advisors.filter((a) => matchesAdvisor(a, query))
    : [];
  const foundOpportunities = searching
    ? opportunities.filter((item) => matchesOpportunity(item, query))
    : [];

  return (
    <Stack gap="spacious">
      <Stack as="section" gap="normal">
        <Heading as="h2" variant="small">
          探索机会
        </Heading>
        <FormControl>
          <FormControl.Label>搜索导师、机会、资源或规则</FormControl.Label>
          <TextInput
            block
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如 程序分析、竞赛、暑校、算力"
          />
        </FormControl>
        <Text as="p" size="small">
          可以从模糊兴趣、具体对象或一个入口问题开始，不需要先填写个人信息。
        </Text>
      </Stack>

      {searching && (
        <Stack as="section" gap="normal" aria-label="搜索结果">
          {foundAdvisors.length + foundOpportunities.length === 0 ? (
            <Text as="p">
              当前收录中没有找到“{query.trim()}
              ”。可以换个关键词；找导师时也可以在“找导师”中对公开来源补查。
            </Text>
          ) : (
            <>
              {foundAdvisors.length > 0 && (
                <Stack gap="condensed">
                  <Text weight="semibold">导师</Text>
                  <ActionList showDividers aria-label="导师">
                    {foundAdvisors.map((advisor) => (
                      <ActionList.Item
                        key={advisor.candidateId}
                        onSelect={() => onOpenAdvisor(advisor.candidateId)}
                      >
                        {advisor.name}
                        <ActionList.Description variant="block">
                          {advisor.institution}。{advisor.research}
                        </ActionList.Description>
                      </ActionList.Item>
                    ))}
                  </ActionList>
                </Stack>
              )}
              {foundOpportunities.length > 0 && (
                <Stack gap="condensed">
                  <Text weight="semibold">机会与入口</Text>
                  {foundOpportunities.map((item) => (
                    <Stack key={item.id} gap="tight">
                      <Link href={item.entry.url} target="_blank" rel="noreferrer">
                        {item.name} <LinkExternalIcon aria-label="在新窗口打开原站" />
                      </Link>
                      <Text size="small">
                        {item.types.map((type) => opportunityTypeText[type]).join("、")}{" "}
                        · {item.period}
                      </Text>
                    </Stack>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Stack>
      )}

      <Stack as="section" gap="normal">
        <Heading as="h2" variant="small">
          按类型浏览
        </Heading>
        <ActionList showDividers aria-label="机会类型">
          <ActionList.Item onSelect={onOpenAdvisors}>
            找导师
            <ActionList.Description variant="block">
              按研究问题认识导师，比较参与途径，并对公开来源补查。目前收录{" "}
              {advisors.length} 名候选。
            </ActionList.Description>
          </ActionList.Item>
          {opportunityTypes.map((type) => (
            <ActionList.Item key={type} onSelect={() => onOpenType(type)}>
              {opportunityTypeText[type]}
              <ActionList.Description variant="block">
                {typeNote(type)}
              </ActionList.Description>
              <ActionList.TrailingVisual>
                <CounterLabel>
                  {opportunities.filter((item) => item.types.includes(type)).length}
                </CounterLabel>
              </ActionList.TrailingVisual>
            </ActionList.Item>
          ))}
        </ActionList>
        <Text as="p" size="small">
          找导师是目前最完整的场景。其他类型目前提供入口与条件查询，比较和公开补查尚未覆盖。
        </Text>
      </Stack>
    </Stack>
  );
}
