import { BookmarkIcon, CheckIcon, PlusIcon } from "@primer/octicons-react";
import { Button, Heading, Link, Stack, Text } from "@primer/react";
import { href } from "../../app/router";
import { RouteStatusLabel, SourceLink, routeKindText } from "../../components/labels";
import type { Advisor } from "../../data/types";
import { toggleCompare } from "../../state/compare";

export function ResultItem({
  advisor,
  inCompare,
  onSave,
}: {
  advisor: Advisor;
  inCompare: boolean;
  onSave: () => void;
}) {
  return (
    <Stack as="article" gap="normal" aria-labelledby={`advisor-${advisor.id}`}>
      <Stack
        direction={{ narrow: "vertical", regular: "horizontal" }}
        justify="space-between"
        align="start"
        gap="condensed"
      >
        <Stack gap="tight">
          <Heading as="h3" variant="medium" id={`advisor-${advisor.id}`}>
            <Link href={href({ page: "advisor", id: advisor.id })}>{advisor.name}</Link>
          </Heading>
          <Text size="medium">
            {advisor.affiliation} · {advisor.region}
          </Text>
        </Stack>
        <Stack direction="horizontal" gap="condensed" wrap="wrap">
          <Button
            size="small"
            leadingVisual={inCompare ? CheckIcon : PlusIcon}
            aria-pressed={inCompare}
            aria-label={
              inCompare ? `将${advisor.name}移出比较` : `将${advisor.name}加入比较`
            }
            onClick={() => toggleCompare(advisor.id)}
          >
            {inCompare ? "已加入比较" : "比较"}
          </Button>
          <Button
            size="small"
            variant="invisible"
            leadingVisual={BookmarkIcon}
            aria-label={`保存${advisor.name}`}
            onClick={onSave}
          >
            保存
          </Button>
        </Stack>
      </Stack>
      <Stack gap="tight">
        <Text size="large">{advisor.question}</Text>
        <Text size="medium">
          相关工作：
          {advisor.work.links[0] ? (
            <Link href={advisor.work.links[0].url} target="_blank" rel="noreferrer">
              {advisor.work.title}
            </Link>
          ) : (
            advisor.work.title
          )}
          {" · "}
          {advisor.work.explanation}
        </Text>
      </Stack>
      <Stack gap="condensed">
        {advisor.routes.length > 0 ? (
          advisor.routes.map((r) => (
            <Stack
              key={r.id}
              direction="horizontal"
              gap="condensed"
              align="center"
              wrap="wrap"
            >
              <Text size="small" weight="semibold">
                {routeKindText[r.kind]}
              </Text>
              <RouteStatusLabel status={r.status} />
              {r.applicability && <Text size="small">{r.applicability}</Text>}
            </Stack>
          ))
        ) : (
          <Text size="small">已读来源中暂无参与途径说明</Text>
        )}
        <Text size="small">待确认：{advisor.unknowns.join("、")}</Text>
      </Stack>
      {advisor.sources[0] && <SourceLink source={advisor.sources[0]} />}
    </Stack>
  );
}
