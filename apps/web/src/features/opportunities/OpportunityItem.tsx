import { BookmarkIcon, LinkExternalIcon } from "@primer/octicons-react";
import { Button, Heading, Label, Link, Stack, Text } from "@primer/react";
import { SourceLink } from "../../components/labels";
import { opportunityTypeText } from "../../data/opportunities";
import type { Opportunity, OpportunityTiming } from "../../data/types";

const timingLabel = {
  historical: { text: "已结束 · 历史参考", variant: "secondary" },
  standing: { text: "常设", variant: "accent" },
  unknown: { text: "当前批次待核", variant: "attention" },
} as const satisfies Record<OpportunityTiming, { text: string; variant: string }>;

export function OpportunityItem({
  opportunity: o,
  onSave,
}: {
  opportunity: Opportunity;
  onSave: () => void;
}) {
  return (
    <Stack as="article" gap="normal" aria-labelledby={`opportunity-${o.id}`}>
      <Stack
        direction={{ narrow: "vertical", regular: "horizontal" }}
        justify="space-between"
        align="start"
        gap="condensed"
      >
        <Heading as="h3" variant="medium" id={`opportunity-${o.id}`}>
          <Link href={o.entry.url} target="_blank" rel="noreferrer">
            {o.name} <LinkExternalIcon aria-label="在新窗口打开原站" />
          </Link>
        </Heading>
        <Button
          size="small"
          variant="invisible"
          leadingVisual={BookmarkIcon}
          aria-label={`保存${o.name}`}
          onClick={onSave}
        >
          保存
        </Button>
      </Stack>
      <Stack gap="condensed">
        <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
          <Label variant={timingLabel[o.timing].variant}>
            {timingLabel[o.timing].text}
          </Label>
          <Text size="small">
            {o.types.map((t) => opportunityTypeText[t]).join("、")}
          </Text>
        </Stack>
        <Text size="medium">{o.period}</Text>
      </Stack>
      <Text size="medium">{o.summary}</Text>
      <Stack gap="condensed">
        <Text size="medium">条件：{o.conditions}</Text>
        {o.support && <Text size="medium">支持与费用：{o.support}</Text>}
        <Text size="medium">注意：{o.caveat}</Text>
      </Stack>
      <SourceLink source={o.entry} />
    </Stack>
  );
}
