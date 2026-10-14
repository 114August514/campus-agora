// One merged result from external discovery: reuse of existing data, a held
// same-name case, or a new lead. Quotes that failed the verbatim check are hidden
// by default and never shown as support.
import { Button, Heading, Label, Link, Stack, Text } from "@primer/react";
import { useState } from "react";
import type { Evidence, Outcome } from "../../api/discovery";
import { href } from "../../app/router";
import { RouteStatusLabel } from "../../components/labels";
import { findAdvisor } from "../../data/advisors";

const kindLabel = {
  matched: { text: "合并到已有资料", variant: "accent" },
  "needs-review": { text: "待核", variant: "attention" },
  new: { text: "新线索", variant: "secondary" },
} as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EvidenceLine({ evidence }: { evidence: Evidence }) {
  return (
    <Stack gap="tight">
      <Text size="medium">“{evidence.quote}”</Text>
      <Text size="small">
        {evidence.supports && `${evidence.supports} · `}
        <Link href={evidence.sourceUrl} target="_blank" rel="noreferrer">
          {evidence.sourceUrl}
        </Link>
        {` · ${formatTime(evidence.retrievedAt)} ${evidence.origin === "live" ? "本次读取" : "缓存快照"}`}
        {!evidence.quoteVerified && " · 未在原文中找到这段文字"}
      </Text>
    </Stack>
  );
}

export function OutcomeItem({ outcome }: { outcome: Outcome }) {
  const [showUnverified, setShowUnverified] = useState(false);
  const c = outcome.candidate;
  const verified = c.evidence.filter((e) => e.quoteVerified);
  const unverified = c.evidence.filter((e) => !e.quoteVerified);
  const existing =
    outcome.kind === "matched" ? findAdvisor(outcome.specimenId) : undefined;

  return (
    <Stack as="article" gap="condensed">
      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Heading as="h4" variant="small">
          {c.name} · {c.affiliation ?? "单位未写明"}
        </Heading>
        <Label variant={kindLabel[outcome.kind].variant}>
          {kindLabel[outcome.kind].text}
        </Label>
      </Stack>

      {outcome.kind === "matched" && (
        <Text size="small">
          与已有资料中的{" "}
          {existing ? (
            <Link href={href({ page: "advisor", id: existing.id })}>
              {existing.name}
            </Link>
          ) : (
            outcome.specimenId
          )}{" "}
          是同一人；
          {outcome.newSourceUrls.length > 0
            ? `补充 ${outcome.newSourceUrls.length} 个新来源，未改动已有条件。`
            : "来源已在已有资料中。"}
        </Text>
      )}
      {outcome.kind === "needs-review" && (
        <Text size="small">{outcome.reason}，没有自动合并，需要确认身份。</Text>
      )}

      {c.researchTopics.length > 0 && (
        <Text size="medium">研究：{c.researchTopics.join("、")}</Text>
      )}
      {c.relationToQuestion && (
        <Text size="small">与问题的联系：{c.relationToQuestion}</Text>
      )}

      {c.routes.map((r, i) => (
        <Stack key={`${r.kind}-${i}`} gap="tight">
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <Text size="medium">{r.description}</Text>
            <RouteStatusLabel status={r.status} />
          </Stack>
          {r.evidence
            .filter((e) => e.quoteVerified)
            .map((e) => (
              <EvidenceLine key={`${e.sourceUrl}-${e.quote}`} evidence={e} />
            ))}
        </Stack>
      ))}

      {verified.map((e) => (
        <EvidenceLine key={`${e.sourceUrl}-${e.quote}`} evidence={e} />
      ))}
      {verified.length === 0 && <Text size="small">没有通过原文核对的依据。</Text>}

      {unverified.length > 0 && (
        <Stack gap="tight">
          <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
            <Text size="small">
              另有 {unverified.length} 条模型给出的依据没能在原文中找到，未作为依据。
            </Text>
            <Button
              size="small"
              variant="invisible"
              onClick={() => setShowUnverified(!showUnverified)}
            >
              {showUnverified ? "收起" : "查看"}
            </Button>
          </Stack>
          {showUnverified &&
            unverified.map((e) => (
              <EvidenceLine key={`${e.sourceUrl}-${e.quote}`} evidence={e} />
            ))}
        </Stack>
      )}

      {c.unknowns.length > 0 && (
        <Text size="small">仍未知：{c.unknowns.join("、")}</Text>
      )}
    </Stack>
  );
}
