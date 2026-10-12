import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscoveryPanel } from "../src/components/DiscoveryPanel";
import { advisors } from "../src/lib/advisors";

describe("follow-up source choice", () => {
  test("offers collected academic pages, leaving login-based posts on their original path", () => {
    const candidate = advisors.find((item) => item.candidateId === "zuming-jiang");
    if (!candidate) throw new Error("Missing collected candidate");
    const html = renderToStaticMarkup(
      <DiscoveryPanel
        query="https://jzuming.github.io/"
        onQueryChange={() => {}}
        onSave={() => {}}
        canSave={false}
        targetCandidate={candidate}
      />,
    );
    expect(html).toContain("读取原站正文");
    expect(html).toContain("公开链接直接从原站读取");
    expect(html).toContain('value="https://jzuming.github.io/"');
    expect(html).toContain('value="https://jzuming.github.io/lab.html"');
    expect(html).not.toContain("xiaohongshu.com");
    expect(html).not.toContain("已取得的正文");
  });

  test("normal keyword discovery keeps its search action and has no candidate-specific source list", () => {
    const html = renderToStaticMarkup(
      <DiscoveryPanel
        query="machine learning"
        onQueryChange={() => {}}
        onSave={() => {}}
        canSave={false}
      />,
    );
    expect(html).toContain("查找外部资料");
    expect(html).not.toContain("也可以选择已收录的官网页面");
    expect(html).not.toContain("读取原站正文");
  });
});
