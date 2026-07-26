import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Badge } from "../src/components/ui/Badge";
import { Button } from "../src/components/ui/Button";
import { EmptyState } from "../src/components/ui/EmptyState";
import { ErrorState } from "../src/components/ui/ErrorState";
import { Input } from "../src/components/ui/Input";
import { LoadingState } from "../src/components/ui/LoadingState";
import { Pagination } from "../src/components/ui/Pagination";
import { Select } from "../src/components/ui/Select";
import { Textarea } from "../src/components/ui/Textarea";

describe("Button", () => {
  test("renders every variant the product uses", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      const { unmount } = render(<Button variant={variant}>操作</Button>);
      expect(screen.getByRole("button", { name: "操作" }).className).toContain(
        `button-${variant}`,
      );
      unmount();
    }
  });

  test("a loading button is disabled and announces itself as busy", () => {
    render(<Button loading>保存</Button>);

    const button = screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;
    // Disabling matters: without it a double click submits twice.
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});

describe("form primitives", () => {
  test("an input associates its label and reports errors as text", () => {
    render(
      <Input
        id="title"
        label="标题"
        error="标题不能为空"
        value=""
        onChange={() => {}}
      />,
    );

    const input = screen.getByLabelText("标题");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    // The error must be readable, not signalled by colour alone.
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      "标题不能为空",
    );
  });

  test("an input without an error is not marked invalid", () => {
    render(<Input id="title" label="标题" value="x" onChange={() => {}} />);

    const input = screen.getByLabelText("标题");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  test("a textarea associates its label and error the same way", () => {
    render(
      <Textarea
        id="body"
        label="正文"
        error="正文不能为空"
        value=""
        onChange={() => {}}
      />,
    );

    const textarea = screen.getByLabelText("正文");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(textarea.getAttribute("aria-describedby") as string)
        ?.textContent,
    ).toBe("正文不能为空");
  });

  test("a select renders its options and current value", () => {
    render(
      <Select
        id="category"
        label="分类"
        value="onboarding"
        onChange={() => {}}
        options={[
          { value: "onboarding", label: "入学指引" },
          { value: "campus_life", label: "校园生活" },
        ]}
      />,
    );

    const select = screen.getByLabelText("分类") as HTMLSelectElement;
    expect(select.value).toBe("onboarding");
    expect(screen.getByRole("option", { name: "校园生活" })).toBeTruthy();
  });
});

describe("Badge", () => {
  test("maps each moderation status to a readable label and tone", () => {
    for (const [status, label] of [
      ["draft", "草稿"],
      ["published", "已发布"],
      ["hidden", "已隐藏"],
      ["rejected", "已退回"],
    ] as const) {
      const { unmount } = render(<Badge status={status} />);
      const badge = screen.getByText(label);
      // Tone is a class, but the label carries the meaning on its own so the
      // status never depends on colour alone.
      expect(badge.className).toContain("badge");
      unmount();
    }
  });
});

describe("state components", () => {
  test("loading state is announced to assistive technology", () => {
    render(<LoadingState label="正在加载资料" />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("正在加载资料");
  });

  test("empty state shows a title and an actionable next step", () => {
    render(
      <EmptyState
        title="还没有资料"
        description="创建第一条资料，让经验被长期保存。"
        action={<Button variant="primary">创建资料</Button>}
      />,
    );

    expect(screen.getByText("还没有资料")).toBeTruthy();
    expect(screen.getByText("创建第一条资料，让经验被长期保存。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "创建资料" })).toBeTruthy();
  });

  test("error state offers a retry and reads as an alert", () => {
    let retried = 0;
    render(<ErrorState message="加载失败，请重试。" onRetry={() => (retried += 1)} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("加载失败，请重试。");

    screen.getByRole("button", { name: "重试" }).click();
    expect(retried).toBe(1);
  });
});

describe("Pagination", () => {
  test("reports the range and disables the boundary controls", () => {
    const { unmount } = render(
      <Pagination
        page={1}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByText("第 1 / 3 页，共 45 条")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "上一页" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "下一页" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    unmount();

    render(
      <Pagination
        page={3}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={() => {}}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "下一页" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("moves to the requested page", () => {
    const seen: number[] = [];
    render(
      <Pagination
        page={2}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={(page) => seen.push(page)}
      />,
    );

    screen.getByRole("button", { name: "上一页" }).click();
    screen.getByRole("button", { name: "下一页" }).click();
    expect(seen).toEqual([1, 3]);
  });
});
