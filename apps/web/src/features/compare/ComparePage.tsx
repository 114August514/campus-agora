import { BookmarkIcon, PlusIcon, XIcon } from "@primer/octicons-react";
import {
  Button,
  Details,
  Heading,
  IconButton,
  Link,
  LinkButton,
  SegmentedControl,
  Stack,
  Text,
} from "@primer/react";
import { Blankslate, Hidden, Table } from "@primer/react/experimental";
import { type ReactNode, useState } from "react";
import { href } from "../../app/router";
import { SaveDialog } from "../../components/SaveDialog";
import {
  RouteStatusLabel,
  SourceLink,
  SourceLinks,
  routeKindText,
} from "../../components/labels";
import { findAdvisor } from "../../data/advisors";
import type { Advisor, RouteKind } from "../../data/types";
import { removeFromCompare, useCompare } from "../../state/compare";
import { useSessionState } from "../../state/useSessionState";

const PURPOSES: (RouteKind | "research")[] = [
  "research",
  "undergrad_research",
  "short_visit",
  "graduate_application",
];

function routesCell(a: Advisor, kind: RouteKind): ReactNode {
  const routes = a.routes.filter((r) => r.kind === kind);
  if (routes.length === 0)
    return (
      <Text size="medium">已读来源中暂无这类途径说明（未知，不等于不可参与）</Text>
    );
  return (
    <Stack gap="normal">
      {routes.map((r) => (
        <Stack key={r.id} gap="condensed">
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <Text size="medium" weight="semibold">
              {r.title}
            </Text>
            <RouteStatusLabel status={r.status} />
          </Stack>
          <Text size="medium">{r.basis}</Text>
          {r.applicability && <Text size="medium">适用范围：{r.applicability}</Text>}
          <Text size="medium">仍需确认：{r.pending}</Text>
          {r.entry && <SourceLink source={r.entry} />}
        </Stack>
      ))}
    </Stack>
  );
}

export function ComparePage() {
  const ids = useCompare();
  const [purpose, setPurpose] = useSessionState<RouteKind | "research">(
    "compare.purpose",
    "research",
  );
  const [saving, setSaving] = useState<Advisor | null>(null);
  const selected = ids.map(findAdvisor).filter((a): a is Advisor => Boolean(a));

  if (selected.length === 0) {
    return (
      <Stack gap="normal">
        <Heading as="h1">比较</Heading>
        <Blankslate>
          <Blankslate.Heading>还没有选择候选</Blankslate.Heading>
          <Blankslate.Description>
            在结果或详情中选择“加入比较”。
          </Blankslate.Description>
          <Blankslate.PrimaryAction href={href({ page: "find" })}>
            去找导师
          </Blankslate.PrimaryAction>
        </Blankslate>
      </Stack>
    );
  }

  const rows: { label: string; render: (a: Advisor) => ReactNode }[] = [
    { label: "研究问题", render: (a) => <Text size="medium">{a.question}</Text> },
    {
      label: "相关工作",
      render: (a) => (
        <Stack gap="condensed">
          <Text size="medium" weight="semibold">
            {a.work.title}
          </Text>
          <Text size="medium">{a.work.explanation}</Text>
          <Text size="small">{a.work.authorshipNote}</Text>
          <SourceLinks sources={a.work.links} />
        </Stack>
      ),
    },
    ...(purpose === "research"
      ? []
      : [
          {
            label: routeKindText[purpose],
            render: (a: Advisor) => routesCell(a, purpose),
          },
        ]),
    {
      label: "指导与经历",
      render: (a) => (
        <Stack gap="condensed">
          <Text size="medium">{a.experience.known}</Text>
          {a.experience.links.length > 0 && (
            <SourceLinks sources={a.experience.links} />
          )}
        </Stack>
      ),
    },
    {
      label: "仍未知",
      render: (a) => <Text size="medium">{a.unknowns.join("、")}</Text>,
    },
    {
      label: "来源与时间",
      render: (a) => (
        <Stack gap="normal">
          <SourceLinks sources={a.sources} />
          {a.sourceNotes.length > 0 && (
            <Details>
              <Details.Summary>
                <Text size="small">查看来源说明</Text>
              </Details.Summary>
              <Stack gap="condensed" paddingBlock="condensed">
                {a.sourceNotes.map((note) => (
                  <Text key={note} size="small">
                    {note}
                  </Text>
                ))}
              </Stack>
            </Details>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Stack
          direction="horizontal"
          gap="normal"
          align="center"
          justify="space-between"
          wrap="wrap"
        >
          <Stack direction="horizontal" gap="normal" align="center">
            <Heading as="h1" id="compare-heading">
              比较
            </Heading>
            <Text size="small">{selected.length} 位候选</Text>
          </Stack>
          <LinkButton href={href({ page: "find" })} leadingVisual={PlusIcon}>
            添加候选
          </LinkButton>
        </Stack>
        <Stack gap="condensed" align="start">
          <Text size="medium" weight="semibold" id="compare-purpose">
            比较视角
          </Text>
          <SegmentedControl
            aria-labelledby="compare-purpose"
            variant={{ narrow: "dropdown", regular: "default" }}
            onChange={(i) => setPurpose(PURPOSES[i])}
          >
            {PURPOSES.map((p) => (
              <SegmentedControl.Button key={p} selected={purpose === p}>
                {p === "research" ? "只看研究" : routeKindText[p]}
              </SegmentedControl.Button>
            ))}
          </SegmentedControl>
        </Stack>
        <Text size="small" id="compare-context">
          按研究问题和参与途径并列呈现，不计算高低。切换视角会保留所选候选；缺少公开信息不代表负面评价。
        </Text>
        {selected.length === 1 && (
          <Text size="medium">当前只有一位候选，可以继续阅读或添加另一位。</Text>
        )}
      </Stack>

      <Hidden when="narrow">
        <Table.Container>
          <Table
            aria-labelledby="compare-heading"
            aria-describedby="compare-context"
            gridTemplateColumns={`minmax(104px, 0.55fr) repeat(${selected.length}, minmax(200px, 1fr))`}
          >
            <Table.Head>
              <Table.Row>
                <Table.Header>比较项</Table.Header>
                {selected.map((a) => (
                  <Table.Header key={a.id} scope="col">
                    <Stack gap="condensed">
                      <Link href={href({ page: "advisor", id: a.id })}>{a.name}</Link>
                      <Text size="small" weight="normal">
                        {a.affiliation}
                      </Text>
                      <Stack direction="horizontal" gap="condensed" align="center">
                        <Button
                          size="small"
                          leadingVisual={BookmarkIcon}
                          aria-label={`保存 ${a.name} 到探索`}
                          onClick={() => setSaving(a)}
                        >
                          保存
                        </Button>
                        <IconButton
                          icon={XIcon}
                          size="small"
                          variant="invisible"
                          aria-label={`从比较中移除 ${a.name}`}
                          onClick={() => removeFromCompare(a.id)}
                        />
                      </Stack>
                    </Stack>
                  </Table.Header>
                ))}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.label}>
                  <Table.Cell scope="row">
                    <Text size="medium" weight="semibold">
                      {row.label}
                    </Text>
                  </Table.Cell>
                  {selected.map((a) => (
                    <Table.Cell key={a.id}>{row.render(a)}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Table.Container>
      </Hidden>
      <Hidden when={["regular", "wide"]}>
        <Stack gap="spacious" aria-label="候选比较" aria-describedby="compare-context">
          <Stack as="section" gap="normal" aria-labelledby="compare-selected">
            <Heading as="h2" variant="small" id="compare-selected">
              已选候选
            </Heading>
            {selected.map((a) => (
              <Stack key={a.id} gap="condensed">
                <Stack
                  direction="horizontal"
                  gap="normal"
                  align="center"
                  justify="space-between"
                >
                  <Link href={href({ page: "advisor", id: a.id })}>{a.name}</Link>
                  <Stack direction="horizontal" gap="condensed" align="center">
                    <Button
                      size="small"
                      leadingVisual={BookmarkIcon}
                      aria-label={`保存 ${a.name} 到探索`}
                      onClick={() => setSaving(a)}
                    >
                      保存
                    </Button>
                    <IconButton
                      icon={XIcon}
                      size="small"
                      variant="invisible"
                      aria-label={`从比较中移除 ${a.name}`}
                      onClick={() => removeFromCompare(a.id)}
                    />
                  </Stack>
                </Stack>
                <Text size="small">{a.affiliation}</Text>
              </Stack>
            ))}
          </Stack>
          {rows.map((row) => (
            <Stack key={row.label} as="section" gap="normal">
              <Heading as="h2" variant="medium">
                {row.label}
              </Heading>
              {selected.map((a) => (
                <Stack key={a.id} gap="condensed">
                  <Text size="medium" weight="semibold">
                    <Link href={href({ page: "advisor", id: a.id })}>{a.name}</Link>
                  </Text>
                  {row.render(a)}
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </Hidden>
      <Text size="small">移出比较不会删除已保存的记录。</Text>
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
