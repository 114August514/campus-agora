import { Button, Link, Stack, Text } from "@primer/react";
import { useState } from "react";
import { sourceDate } from "../lib/advisors";
import type { SourceSnapshot } from "../lib/exploration-store";

export function SourceView({ source }: { source: SourceSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const summary = source.collection?.contentKind === "summary";
  const body = source.collection?.contentKind === "body" || source.kind === "live";
  const contentLabel = summary ? "整理摘要" : body ? "已取得的正文" : "已有资料";
  return (
    <Stack gap="condensed">
      <Link href={source.lookupUrl ?? source.url} target="_blank" rel="noreferrer">
        {source.title}
        {source.lookupUrl ? "（站内查找）" : ""}
      </Link>
      {source.accessNote && <Text as="p">{source.accessNote}</Text>}
      <Text size="small">
        {source.collection
          ? `预采集资料（${source.collection.method === "browser_dom" ? "浏览器读取" : "网页读取"}）`
          : source.kind === "live"
            ? "本次外部正文读取"
            : "既有资料说明"}{" "}
        · {sourceDate(source.collectedAt)}
        {source.publishedAt
          ? ` · 原页时间（采集时显示）：${source.publishedAt}`
          : " · 原页发布时间未确认"}
      </Text>
      {source.collection && (
        <Text as="p">
          {summary ? "整理摘要，未提供全文。" : "正文读取。"}
          {source.collection.readStatus === "partial"
            ? "仅部分内容已读取。"
            : "已完成本次范围内的读取。"}
          采集范围：{source.collection.scope}。
        </Text>
      )}
      {source.query && <Text as="p">查找内容：{source.query}</Text>}
      {source.relevanceEvidence?.length ? (
        <Text as="p" whiteSpace="pre-wrap">
          <Text weight="semibold">
            {summary
              ? "与查找相关的信息（整理）："
              : body
                ? "匹配查找内容的页面节选："
                : "与查找相关的信息："}
          </Text>
          {source.relevanceEvidence.join("\n")}
        </Text>
      ) : null}
      {source.unknowns?.map((unknown) => (
        <Text as="p" key={unknown}>
          {unknown}
        </Text>
      ))}
      {(source.kind !== "live" || expanded) && (
        <Text as="p" whiteSpace="pre-wrap">
          {expanded ? source.content : source.content.slice(0, 500)}
        </Text>
      )}
      {(source.kind === "live" || source.content.length > 500) && (
        <Button
          variant="invisible"
          size="small"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? `收起${summary ? "摘要" : body ? "正文" : "资料"}`
            : `查看${contentLabel}`}
        </Button>
      )}
    </Stack>
  );
}
