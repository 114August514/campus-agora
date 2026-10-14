import { Label, Link, Stack, Text } from "@primer/react";
import type { RouteKind, RouteStatus, SourceRef } from "../data/types";

export const routeKindText: Record<RouteKind, string> = {
  undergrad_research: "本科科研",
  short_visit: "短期访问",
  graduate_application: "研究生申请",
};

const statusText: Record<RouteStatus, string> = {
  explicit: "本人说明",
  institutional: "仅院系／项目入口",
  unconfirmed: "途径待核",
};

const statusVariant = {
  explicit: "accent",
  institutional: "secondary",
  unconfirmed: "attention",
} as const satisfies Record<RouteStatus, string>;

export function RouteStatusLabel({ status }: { status: RouteStatus }) {
  return <Label variant={statusVariant[status]}>{statusText[status]}</Label>;
}

export function SourceLink({ source }: { source: SourceRef }) {
  return (
    <Text size="small">
      <Link href={source.url} target="_blank" rel="noreferrer">
        {source.label}
      </Link>
      <Text size="small"> · {source.checkedAt} 查看</Text>
    </Text>
  );
}

export function SourceLinks({ sources }: { sources: SourceRef[] }) {
  return (
    <Stack gap="condensed">
      {sources.map((s) => (
        <SourceLink key={`${s.url}-${s.label}`} source={s} />
      ))}
    </Stack>
  );
}
