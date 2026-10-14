import { SearchIcon, TableIcon } from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  Checkbox,
  CounterLabel,
  FormControl,
  Heading,
  LinkButton,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { href } from "../../app/router";
import { SaveDialog } from "../../components/SaveDialog";
import { routeKindText } from "../../components/labels";
import { FIXED_DATA_AS_OF, advisors } from "../../data/advisors";
import type { Advisor, RouteKind } from "../../data/types";
import { useCompare } from "../../state/compare";
import { useSessionState } from "../../state/useSessionState";
import { ExternalDiscovery } from "./ExternalDiscovery";
import { ResultItem } from "./ResultItem";

const ROUTE_OPTIONS: (RouteKind | "all")[] = [
  "all",
  "undergrad_research",
  "short_visit",
  "graduate_application",
];
const REGIONS = ["全部地区", "内地", "香港", "美国"] as const;

export function matchesAdvisor(a: Advisor, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    a.name,
    a.affiliation,
    a.region,
    a.question,
    a.work.title,
    a.work.explanation,
    ...a.routes.map((r) => r.title),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

export function FindPage() {
  const [query, setQuery] = useSessionState("find.query", "");
  const [routeKind, setRouteKind] = useSessionState<RouteKind | "all">(
    "find.route",
    "all",
  );
  const [region, setRegion] = useSessionState<(typeof REGIONS)[number]>(
    "find.region",
    "全部地区",
  );
  const [explicitOnly, setExplicitOnly] = useSessionState("find.explicitOnly", false);
  const [showWithoutRoute, setShowWithoutRoute] = useState(false);
  const [saving, setSaving] = useState<Advisor | null>(null);
  const compare = useCompare();

  const base = advisors.filter(
    (a) => matchesAdvisor(a, query) && (region === "全部地区" || a.region === region),
  );
  const hasRoute = (a: Advisor) =>
    a.routes.some(
      (r) =>
        (routeKind === "all" || r.kind === routeKind) &&
        (!explicitOnly || r.status === "explicit"),
    );
  const routeFilterActive = routeKind !== "all" || explicitOnly;
  const results = routeFilterActive ? base.filter(hasRoute) : base;
  const withoutRoute = routeFilterActive ? base.filter((a) => !hasRoute(a)) : [];
  const filtersActive = routeFilterActive || region !== "全部地区";

  const clearFilters = () => {
    setRouteKind("all");
    setRegion("全部地区");
    setExplicitOnly(false);
  };
  const resetSearch = () => {
    setQuery("");
    clearFilters();
  };

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Heading as="h1">找导师</Heading>
        <FormControl>
          <FormControl.Label>搜索导师或研究方向</FormControl.Label>
          <TextInput
            leadingVisual={SearchIcon}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入姓名、机构或一个研究问题"
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
          <SegmentedControl
            aria-label="参与途径"
            variant={{ narrow: "dropdown", regular: "default" }}
            onChange={(i) => setRouteKind(ROUTE_OPTIONS[i])}
          >
            {ROUTE_OPTIONS.map((k) => (
              <SegmentedControl.Button key={k} selected={routeKind === k}>
                {k === "all" ? "全部途径" : routeKindText[k]}
              </SegmentedControl.Button>
            ))}
          </SegmentedControl>
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <ActionMenu>
              <ActionMenu.Button aria-label={`筛选地区：${region}`}>
                {region}
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList selectionVariant="single" aria-label="地区">
                  {REGIONS.map((r) => (
                    <ActionList.Item
                      key={r}
                      selected={region === r}
                      onSelect={() => setRegion(r)}
                    >
                      {r}
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
        </Stack>
        <Stack direction="horizontal" gap="normal" align="center" wrap="wrap">
          <FormControl>
            <Checkbox
              checked={explicitOnly}
              onChange={(e) => setExplicitOnly(e.target.checked)}
            />
            <FormControl.Label>只看本人有明确说明的途径</FormControl.Label>
          </FormControl>
          {explicitOnly && <Text size="small">长期招募说明仍需确认目标年度名额。</Text>}
        </Stack>
      </Stack>

      <Stack as="section" gap="spacious" aria-labelledby="existing-results-heading">
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          justify="space-between"
          align={{ narrow: "start", regular: "center" }}
          gap="normal"
        >
          <Stack gap="tight">
            <Stack direction="horizontal" gap="condensed" align="center">
              <Heading as="h2" variant="medium" id="existing-results-heading">
                已有资料
              </Heading>
              <CounterLabel aria-label={`${results.length} 位候选`}>
                {results.length}
              </CounterLabel>
            </Stack>
            <Text size="small">固定样本 · {FIXED_DATA_AS_OF} 整理</Text>
          </Stack>
          {compare.length > 0 && (
            <LinkButton href={href({ page: "compare" })} leadingVisual={TableIcon}>
              查看比较（{compare.length}）
            </LinkButton>
          )}
        </Stack>
        {results.length === 0 ? (
          <Blankslate>
            <Blankslate.Heading>当前资料中没有匹配结果</Blankslate.Heading>
            <Blankslate.Description>
              可以缩短关键词、放宽筛选，或用下方外部补查继续查找。
            </Blankslate.Description>
            {(filtersActive || query.trim()) && (
              <Blankslate.PrimaryAction onClick={resetSearch}>
                查看全部已有资料
              </Blankslate.PrimaryAction>
            )}
          </Blankslate>
        ) : (
          results.map((a) => (
            <ResultItem
              key={a.id}
              advisor={a}
              inCompare={compare.includes(a.id)}
              onSave={() => setSaving(a)}
            />
          ))
        )}
        {withoutRoute.length > 0 && (
          <Stack gap="normal">
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Text size="small">
                另有 {withoutRoute.length}{" "}
                位候选的已读来源中没有符合条件的途径说明，不代表不可参与。
              </Text>
              <Button
                size="small"
                variant="invisible"
                onClick={() => setShowWithoutRoute(!showWithoutRoute)}
                aria-expanded={showWithoutRoute}
                aria-controls={showWithoutRoute ? "other-route-results" : undefined}
              >
                {showWithoutRoute ? "收起候选" : "展开候选"}
              </Button>
            </Stack>
            {showWithoutRoute && (
              <Stack id="other-route-results" gap="spacious">
                {withoutRoute.map((a) => (
                  <ResultItem
                    key={a.id}
                    advisor={a}
                    inCompare={compare.includes(a.id)}
                    onSave={() => setSaving(a)}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      <ExternalDiscovery query={query} />
      {saving && (
        <SaveDialog
          item={{ kind: "advisor", id: saving.id }}
          name={saving.name}
          onClose={() => setSaving(null)}
        />
      )}
    </Stack>
  );
}
