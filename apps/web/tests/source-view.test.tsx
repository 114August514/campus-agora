import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceView } from "../src/components/SourceView";
import type { SourceSnapshot } from "../src/lib/exploration-store";

const source: SourceSnapshot = {
  url: "https://example.edu/recruitment",
  title: "Public recruitment page",
  content: "A source summary. ".repeat(50),
  collectedAt: "2026-10-04T12:00:00.000Z",
  kind: "snapshot",
  relevanceEvidence: ["A summary of the participation information."],
  unknowns: ["Images were not read."],
  collection: {
    method: "browser_dom",
    contentKind: "summary",
    readStatus: "partial",
    scope: "Visible text only",
    batchId: "example-collection",
  },
};

describe("source presentation", () => {
  test("uses the public site lookup route and explains how to reopen a stored source", () => {
    const html = renderToStaticMarkup(
      <SourceView
        source={{
          ...source,
          lookupUrl: "https://example.edu/search?keyword=recruitment",
          accessNote: "Find the post by title after opening the site search.",
          publishedAt: "Edited six days before collection",
        }}
      />,
    );
    expect(html).toContain('href="https://example.edu/search?keyword=recruitment"');
    expect(html).not.toContain('href="https://example.edu/recruitment"');
    expect(html).toContain("Public recruitment page（站内查找）");
    expect(html).toContain("Find the post by title after opening the site search.");
    expect(html).toContain("原页时间（采集时显示）：Edited six days before collection");
  });

  test("collected summaries do not claim full body text or verbatim page passages", () => {
    const html = renderToStaticMarkup(<SourceView source={source} />);
    expect(html).toContain("预采集资料");
    expect(html).toContain("整理摘要，未提供全文");
    expect(html).toContain("仅部分内容已读取");
    expect(html).toContain("Visible text only");
    expect(html).toContain("Images were not read.");
    expect(html).toContain("与查找相关的信息（整理）");
    expect(html).toContain("查看整理摘要");
    expect(html).not.toContain("查看已取得的正文");
    expect(html).not.toContain("页面节选");
    expect(html).toContain('href="https://example.edu/recruitment"');
    expect(html).not.toContain("（站内查找）");
  });

  test("existing live sources still identify the current body-reading path", () => {
    const html = renderToStaticMarkup(
      <SourceView source={{ ...source, collection: undefined, kind: "live" }} />,
    );
    expect(html).toContain("本次外部正文读取");
    expect(html).toContain("查看已取得的正文");
    expect(html).not.toContain("预采集资料");
  });

  test("legacy notes without capture metadata remain readable without claiming fetched body text", () => {
    const html = renderToStaticMarkup(
      <SourceView source={{ ...source, collection: undefined }} />,
    );
    expect(html).toContain("既有资料说明");
    expect(html).toContain("查看已有资料");
    expect(html).not.toContain("查看已取得的正文");
  });
});
