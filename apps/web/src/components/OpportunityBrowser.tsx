import { BookmarkIcon, LinkExternalIcon } from "@primer/octicons-react";
import {
  Button,
  Checkbox,
  FormControl,
  Heading,
  Label,
  Link,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useState } from "react";
import {
  type Opportunity,
  type OpportunityTiming,
  type OpportunityType,
  matchesOpportunity,
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";

const timingLabel = {
  historical: { text: "已结束 · 历史参考", variant: "secondary" },
  standing: { text: "常设", variant: "accent" },
  unknown: { text: "当前批次待核", variant: "attention" },
} as const satisfies Record<OpportunityTiming, { text: string; variant: string }>;

// Ended batches sort last; they stay visible as reference unless hidden.
const timingOrder: Record<OpportunityTiming, number> = {
  standing: 0,
  unknown: 1,
  historical: 2,
};

export function OpportunityBrowser({
  type,
  onTypeChange,
  canSave,
  onSave,
}: {
  type: OpportunityType | "";
  onTypeChange: (type: OpportunityType | "") => void;
  canSave: boolean;
  onSave: (opportunity: Opportunity) => void;
}) {
  const [query, setQuery] = useState("");
  const [hideEnded, setHideEnded] = useState(false);
  const inScope = opportunities.filter(
    (item) => (!type || item.types.includes(type)) && matchesOpportunity(item, query),
  );
  const shown = inScope
    .filter((item) => !hideEnded || item.timing !== "historical")
    .sort((a, b) => timingOrder[a.timing] - timingOrder[b.timing]);
  const hidden = inScope.length - shown.length;

  return (
    <Stack as="section" gap="normal">
      <Heading as="h2" variant="small">
        机会与入口
      </Heading>
      <Text as="p">
        科研、升学、实习、竞赛、交流、活动、资源与规则的入口和适用条件。找到入口即可结束；名额与截止日期以原站为准。
      </Text>
      <Stack
        direction={{ narrow: "vertical", regular: "horizontal" }}
        gap="normal"
        align={{ narrow: "stretch", regular: "end" }}
      >
        <FormControl>
          <FormControl.Label>关键词</FormControl.Label>
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如 竞赛、算力、暑校、推免"
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>类型</FormControl.Label>
          <Select
            value={type}
            onChange={(event) =>
              onTypeChange(event.target.value as OpportunityType | "")
            }
          >
            <Select.Option value="">全部类型</Select.Option>
            {opportunityTypes.map((item) => (
              <Select.Option key={item} value={item}>
                {opportunityTypeText[item]}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <Checkbox
            checked={hideEnded}
            onChange={(event) => setHideEnded(event.target.checked)}
          />
          <FormControl.Label>隐藏已结束的批次</FormControl.Label>
        </FormControl>
      </Stack>
      <Text as="p" size="small">
        共 {shown.length} 项{hidden > 0 && `，另有 ${hidden} 项已结束的批次已隐藏`}。
        {!canSave && " 想保留时，先在上方选择或创建主题。"}
      </Text>
      {shown.length === 0 && (
        <Text as="p">
          当前收录中没有找到。这不代表没有相关机会，可以换个关键词或类型，或到学校、院系官网查找。
        </Text>
      )}
      {shown.map((item) => (
        <OpportunityItem
          key={item.id}
          opportunity={item}
          canSave={canSave}
          onSave={() => onSave(item)}
        />
      ))}
    </Stack>
  );
}

function OpportunityItem({
  opportunity,
  canSave,
  onSave,
}: {
  opportunity: Opportunity;
  canSave: boolean;
  onSave: () => void;
}) {
  const label = timingLabel[opportunity.timing];
  return (
    <Stack
      as="article"
      gap="condensed"
      aria-labelledby={`opportunity-${opportunity.id}`}
    >
      <Heading as="h3" variant="small" id={`opportunity-${opportunity.id}`}>
        <Link href={opportunity.entry.url} target="_blank" rel="noreferrer">
          {opportunity.name} <LinkExternalIcon aria-label="在新窗口打开原站" />
        </Link>
      </Heading>
      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Label variant={label.variant}>{label.text}</Label>
        <Text size="small">
          {opportunity.types.map((type) => opportunityTypeText[type]).join("、")} ·{" "}
          {opportunity.period}
        </Text>
      </Stack>
      <Text as="p">{opportunity.summary}</Text>
      <Text as="p">
        <Text weight="semibold">条件：</Text>
        {opportunity.conditions}
      </Text>
      {opportunity.support && (
        <Text as="p">
          <Text weight="semibold">支持与费用：</Text>
          {opportunity.support}
        </Text>
      )}
      <Text as="p">
        <Text weight="semibold">注意：</Text>
        {opportunity.caveat}
      </Text>
      <Text as="p" size="small">
        来源：{opportunity.entry.label}，{opportunity.entry.checkedAt} 查看
      </Text>
      <Stack direction="horizontal">
        <Button
          size="small"
          leadingVisual={BookmarkIcon}
          disabled={!canSave}
          aria-label={`保存${opportunity.name}到主题`}
          onClick={onSave}
        >
          保存到主题
        </Button>
      </Stack>
    </Stack>
  );
}
