import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * These drive the real pages through the typed mock fetch, so a page that
 * mis-reads the API envelope fails here rather than in the browser.
 */

const TOKEN_KEY = "campus-agora.session-token";

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
}

async function loadPages(token?: string) {
  const storage = new MemoryStorage();
  if (token) {
    storage.setItem(TOKEN_KEY, token);
  }

  // Only the storage slots are replaced. Swapping the whole `window` would
  // strip happy-dom's event APIs, which React needs to dispatch events.
  Object.defineProperty(globalThis.window, "sessionStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis.window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });

  const cacheBust = Math.random();
  const [list, detail, editor] = await Promise.all([
    import(`../src/pages/ArchiveListPage?t=${cacheBust}`),
    import(`../src/pages/ArchiveDetailPage?t=${cacheBust}`),
    import(`../src/pages/ArchiveEditorPage?t=${cacheBust}`),
  ]);

  return {
    ArchiveListPage: list.ArchiveListPage,
    ArchiveDetailPage: detail.ArchiveDetailPage,
    ArchiveEditorPage: editor.ArchiveEditorPage,
  };
}

const guestSession = { state: { status: "guest" } } as never;

describe("archive list page", () => {
  afterEach(cleanup);

  test("shows a loading state, then an empty state when nothing is published", async () => {
    const { ArchiveListPage } = await loadPages();

    // A query nothing can match, so the empty state is asserted independently
    // of whatever other tests in this file have seeded.
    render(
      <MemoryRouter initialEntries={["/archive?q=nothing-matches-this"]}>
        <Routes>
          <Route path="/archive" element={<ArchiveListPage session={guestSession} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status").textContent).toContain("正在加载资料");

    await waitFor(() => {
      expect(screen.getByText("没有匹配的资料")).toBeTruthy();
    });
  });

  test("filters are read from the URL so a filtered list is linkable", async () => {
    const { ArchiveListPage } = await loadPages();

    render(
      <MemoryRouter
        initialEntries={["/archive?q=%E5%AE%BF%E8%88%8D&category=campus_life"]}
      >
        <Routes>
          <Route path="/archive" element={<ArchiveListPage session={guestSession} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("搜索") as HTMLInputElement).value).toBe("宿舍");
    });
    expect((screen.getByLabelText("分类") as HTMLSelectElement).value).toBe(
      "campus_life",
    );
  });

  test("guests are not offered the create action", async () => {
    const { ArchiveListPage } = await loadPages();

    render(
      <MemoryRouter initialEntries={["/archive?q=nothing-matches-this"]}>
        <Routes>
          <Route path="/archive" element={<ArchiveListPage session={guestSession} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("没有匹配的资料")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "创建资料" })).toBeNull();
  });
});

describe("archive detail page", () => {
  afterEach(cleanup);

  test("an entry the viewer may not see renders a not-found state, not an error", async () => {
    const { ArchiveDetailPage } = await loadPages();

    render(
      <MemoryRouter initialEntries={["/archive/00000000-0000-4000-8000-999999999999"]}>
        <Routes>
          <Route
            path="/archive/:id"
            element={<ArchiveDetailPage session={guestSession} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("资料不存在或不可见")).toBeTruthy();
    });
    // A 404 must not be surfaced as a failure the user should retry.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("archive editor page", () => {
  afterEach(cleanup);

  test("blocks submission until the required fields are filled", async () => {
    const { ArchiveEditorPage } = await loadPages();

    render(
      <MemoryRouter initialEntries={["/archive/new"]}>
        <Routes>
          <Route path="/archive/new" element={<ArchiveEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: "创建草稿" }).click();

    await waitFor(() => {
      expect(screen.getByText("标题不能为空。")).toBeTruthy();
    });
    expect(screen.getByText("正文不能为空。")).toBeTruthy();

    // The errors are wired to their inputs, not just rendered nearby.
    const title = screen.getByLabelText("标题");
    expect(title.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("design system page", () => {
  afterEach(cleanup);

  test("renders every primitive and every product state", async () => {
    // quality.md makes this the manual visual-regression entry point, so a
    // primitive that stops rendering here must fail a test rather than be
    // noticed by eye.
    const { DesignSystemPage } = await import(
      `../src/pages/DesignSystemPage?t=${Math.random()}`
    );

    render(
      <MemoryRouter>
        <DesignSystemPage />
      </MemoryRouter>,
    );

    for (const heading of [
      "按钮",
      "表单",
      "状态标签",
      "卡片",
      "加载、空、错误与未授权状态",
      "分页",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    for (const label of [
      "主操作",
      "次操作",
      "弱操作",
      "危险操作",
      "加载中",
      "不可用",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    expect(screen.getByLabelText("输入框")).toBeTruthy();
    expect(screen.getByLabelText("多行文本")).toBeTruthy();
    expect(screen.getByLabelText("下拉选择")).toBeTruthy();
    expect(screen.getByText("标题不能为空。")).toBeTruthy();

    for (const status of ["草稿", "已发布", "已隐藏", "已退回"]) {
      expect(screen.getByText(status)).toBeTruthy();
    }

    // Every product state a flow can land in.
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("还没有资料")).toBeTruthy();
    expect(screen.getByText("需要登录")).toBeTruthy();
    expect(screen.getByText("没有权限")).toBeTruthy();
  });
});

describe("archive list with content", () => {
  afterEach(cleanup);

  // Imported without a cache-buster so this is the same client instance the
  // pages hold; a fresh module would get its own empty mock store.
  // Imported without a cache-buster so these are the same module instances the
  // pages hold; a fresh copy would get its own empty mock store and its own
  // token cache.
  async function seededList() {
    const { ArchiveListPage } = await loadPages();
    const { apiClient } = await import("../src/lib/api");
    const { setSessionToken } = await import("../src/features/auth/session");

    return { ArchiveListPage, apiClient, setSessionToken };
  }

  test("renders an entry card, its badge, and the pagination summary", async () => {
    const { ArchiveListPage, apiClient, setSessionToken } = await seededList();

    const login = await apiClient.mockLogin("student");
    // Through the setter, because the session module caches the token in a
    // module-level variable that a direct storage write would not update.
    setSessionToken(login.token);
    const entry = await apiClient.createKnowledgeEntry({
      title: "宿舍生活指南",
      body: "正文",
      summary: "一句话摘要",
      tags: ["新生"],
      category: "campus_life",
      applicableAudience: "new_students",
      sourceKind: "firsthand_experience",
    });
    await apiClient.changeKnowledgeEntryStatus(entry.id, "published");

    render(
      <MemoryRouter
        initialEntries={[
          "/archive?q=%E5%AE%BF%E8%88%8D%E7%94%9F%E6%B4%BB%E6%8C%87%E5%8D%97",
        ]}
      >
        <Routes>
          <Route path="/archive" element={<ArchiveListPage session={guestSession} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("宿舍生活指南")).toBeTruthy();
    });

    // The card renders its status badge, metadata, tags, and the paging line.
    expect(screen.getByText("已发布")).toBeTruthy();
    expect(screen.getByText("一句话摘要")).toBeTruthy();
    expect(screen.getByText("新生")).toBeTruthy();
    expect(screen.getByText("第 1 / 1 页，共 1 条")).toBeTruthy();

    setSessionToken(undefined);
  });
});
