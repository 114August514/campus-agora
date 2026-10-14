import { SearchIcon } from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  Checkbox,
  CounterLabel,
  FormControl,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { href, navigate } from "../../app/router";
import { SaveDialog } from "../../components/SaveDialog";
import {
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../../data/opportunities";
import type { Opportunity, OpportunityType } from "../../data/types";
import { useSessionState } from "../../state/useSessionState";
import { OpportunityItem } from "./OpportunityItem";

// Ended batches sort last; they stay visible as reference unless hidden.
const timingOrder = { standing: 0, unknown: 1, historical: 2 } as const;

export function matchesOpportunity(o: Opportunity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    o.name,
    o.summary,
    o.conditions,
    o.support ?? "",
    o.period,
    ...o.types.map((t) => opportunityTypeText[t]),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

export function OpportunitiesPage({ type }: { type?: OpportunityType }) {
  const [query, setQuery] = useSessionState("opportunities.query", "");
  const [hideEnded, setHideEnded] = useSessionState("opportunities.hideEnded", false);
  const [saving, setSaving] = useState<Opportunity | null>(null);

  const matched = opportunities
    .filter((o) => (!type || o.types.includes(type)) && matchesOpportunity(o, query))
    .filter((o) => !hideEnded || o.timing !== "historical")
    .sort((a, b) => timingOrder[a.timing] - timingOrder[b.timing]);
  const endedHidden = hideEnded
    ? opportunities.filter(
        (o) =>
          o.timing === "historical" &&
          (!type || o.types.includes(type)) &&
          matchesOpportunity(o, query),
      ).length
    : 0;
  const filtersActive = Boolean(type) || hideEnded;
  const clearFilters = () => {
    setHideEnded(false);
    navigate({ page: "opportunities" });
  };

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Heading as="h1">机会与入口</Heading>
        <FormControl>
          <FormControl.Label>搜索机会、资源或规则</FormControl.Label>
          <TextInput
            leadingVisual={SearchIcon}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：竞赛、算力、暑校、推免"
            size="large"
            block
          />
        </FormControl>
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="normal"
          align={{ narrow: "start", regular: "center" }}
          wrap="wrap"
        >
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <ActionMenu>
              <ActionMenu.Button
                aria-label={`筛选类型：${type ? opportunityTypeText[type] : "全部类型"}`}
              >
                {type ? opportunityTypeText[type] : "全部类型"}
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList selectionVariant="single" aria-label="类型">
                  <ActionList.Item
                    selected={!type}
                    onSelect={() => navigate({ page: "opportunities" })}
                  >
                    全部类型
                  </ActionList.Item>
                  {opportunityTypes.map((t) => (
                    <ActionList.Item
                      key={t}
                      selected={type === t}
                      onSelect={() => navigate({ page: "opportunities", type: t })}
                    >
                      {opportunityTypeText[t]}
                    </ActionList.Item>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
            {filtersActive && (
              <Button variant="invisible" onClick={clearFilters}>
                清除筛选
              </Button>
            )}
          </Stack>
          <FormControl>
            <Checkbox
              checked={hideEnded}
              onChange={(e) => setHideEnded(e.target.checked)}
            />
            <FormControl.Label>隐藏已结束的批次</FormControl.Label>
          </FormControl>
        </Stack>
        {type === "research" && (
          <Text size="small">
            想按研究问题找导师、比较参与途径，去{" "}
            <Link href={href({ page: "find" })}>找导师</Link>。
          </Text>
        )}
      </Stack>

      <Stack as="section" gap="spacious" aria-labelledby="opportunity-results-heading">
        <Stack gap="condensed">
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <Heading as="h2" variant="medium" id="opportunity-results-heading">
              已有资料
            </Heading>
            <CounterLabel aria-label={`${matched.length} 项入口与条件说明`}>
              {matched.length}
            </CounterLabel>
          </Stack>
          {endedHidden > 0 && (
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Text size="small">另有 {endedHidden} 项已结束的批次已隐藏。</Text>
              <Button
                size="small"
                variant="invisible"
                onClick={() => setHideEnded(false)}
              >
                显示历史参考
              </Button>
            </Stack>
          )}
          <Text size="small">找到入口即可结束，不需要先做准备。</Text>
        </Stack>
        {matched.length === 0 ? (
          <Blankslate>
            <Blankslate.Heading>当前收录中未找到</Blankslate.Heading>
            <Blankslate.Description>
              这不代表没有相关机会。可以换个关键词或类型，或直接到学校、院系官网查找。
            </Blankslate.Description>
            {filtersActive ? (
              <Blankslate.PrimaryAction onClick={clearFilters}>
                清除筛选
              </Blankslate.PrimaryAction>
            ) : query.trim() ? (
              <Blankslate.PrimaryAction onClick={() => setQuery("")}>
                清空搜索
              </Blankslate.PrimaryAction>
            ) : null}
          </Blankslate>
        ) : (
          matched.map((o) => (
            <OpportunityItem key={o.id} opportunity={o} onSave={() => setSaving(o)} />
          ))
        )}
      </Stack>

      {saving && (
        <SaveDialog
          item={{ kind: "opportunity", id: saving.id }}
          name={saving.name}
          onClose={() => setSaving(null)}
        />
      )}
    </Stack>
  );
}
