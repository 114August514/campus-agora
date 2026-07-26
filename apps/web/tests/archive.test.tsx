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

    render(
      <MemoryRouter initialEntries={["/archive"]}>
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
      <MemoryRouter initialEntries={["/archive"]}>
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
