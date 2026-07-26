import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setSessionToken } from "../src/features/auth/session";
import { apiClient as typedClient } from "../src/lib/api";
import { ArchiveDetailPage } from "../src/pages/ArchiveDetailPage";
import { DiscussionDetailPage } from "../src/pages/DiscussionDetailPage";
import { DiscussionEditorPage } from "../src/pages/DiscussionEditorPage";
import { DiscussionListPage } from "../src/pages/DiscussionListPage";

/**
 * These drive the real discussion pages through the typed mock fetch, which
 * enforces the same rules the server does. A page that offers an action the
 * server refuses, or that mis-reads the loop, fails here rather than in a
 * browser.
 *
 * Everything is imported statically and shares one mock store, because the
 * pages import `lib/api` by its plain path: a cache-busted copy in the test
 * would be a different client talking to a different store, and the seeding
 * would be invisible to the page under test. Tests stay independent by using
 * a distinct title per fixture instead.
 */

// biome-ignore lint/suspicious/noExplicitAny: the client is fully typed at its
// own boundary; restating every method here would add nothing.
const apiClient = typedClient as any;

let seedCounter = 0;

async function signIn(persona: string) {
  const login = await apiClient.mockLogin(persona);
  setSessionToken(login.token);
  return login;
}

function signOut() {
  setSessionToken(undefined);
}

/** A published thread with one reply, titled uniquely so one test's fixture
 * is never matched by another's assertions. */
async function seedThread() {
  seedCounter += 1;
  const title = `场地申请流程-${seedCounter}`;
  const login = await signIn("student");
  const created = await apiClient.createDiscussion({
    title,
    body: `有人知道场地申请怎么走吗？（${seedCounter}）`,
    tags: ["办事流程"],
  });
  await apiClient.changeDiscussionStatus(created.id, "published");
  const reply = await apiClient.replyToDiscussion(
    created.id,
    `先去团委登记，再到场馆办公室盖章。（${seedCounter}）`,
  );

  return {
    login,
    title,
    id: created.id,
    replyId: reply.id,
    replyBody: `先去团委登记，再到场馆办公室盖章。（${seedCounter}）`,
  };
}

const guestSession = { state: { status: "guest" } } as never;

function authedSession(user: unknown) {
  return { state: { status: "authenticated", user } } as never;
}

/** Assigning `.value` directly bypasses React's controlled-input tracking, so
 * the component never sees the change. `fireEvent.change` goes through the
 * native setter the way a real keystroke does. */
function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

function renderList(session: unknown, search = "") {
  return render(
    <MemoryRouter initialEntries={[`/discussions${search}`]}>
      <Routes>
        <Route path="/discussions" element={<DiscussionListPage session={session} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(id: string, session: unknown) {
  return render(
    <MemoryRouter initialEntries={[`/discussions/${id}`]}>
      <Routes>
        <Route
          path="/discussions/:id"
          element={<DiscussionDetailPage session={session} />}
        />
        <Route path="/archive/:id/edit" element={<p>资料编辑器</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEntry(id: string, session: unknown) {
  return render(
    <MemoryRouter initialEntries={[`/archive/${id}`]}>
      <Routes>
        <Route path="/archive/:id" element={<ArchiveDetailPage session={session} />} />
        <Route path="/discussions/:id" element={<p>来源讨论</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

// The session module caches the token in memory at import time, reading it
// from a `window.sessionStorage` that every test file shares. Another file can
// therefore leave a token that makes this file's first request 401 — which is
// exactly what happened in CI, where the file order differs from a local run.
// Stating the invariant on both sides makes the file independent of ordering.
beforeEach(signOut);

afterEach(() => {
  cleanup();
  signOut();
});

describe("discussion list page", () => {
  test("shows a loading state, then an empty state when nothing matches", async () => {
    renderList(guestSession, "?q=nothing-matches-this");

    expect(screen.getByRole("status").textContent).toContain("正在加载讨论");

    await waitFor(() => {
      expect(screen.getByText("没有匹配的讨论")).toBeTruthy();
    });
  });

  test("filters are read from the URL so a filtered list is linkable", async () => {
    renderList(guestSession, "?q=%E5%AE%BF%E8%88%8D&tag=%E9%A3%9F%E5%A0%82");

    await waitFor(() => {
      expect((screen.getByLabelText("搜索") as HTMLInputElement).value).toBe("宿舍");
    });
    expect((screen.getByLabelText("标签") as HTMLInputElement).value).toBe("食堂");
  });

  test("guests are not offered the create action", async () => {
    renderList(guestSession, "?q=nothing-matches-this");

    await waitFor(() => {
      expect(screen.getByText("没有匹配的讨论")).toBeTruthy();
    });
    expect(screen.queryByText("发起讨论")).toBeNull();
  });

  /**
   * Activity signals, not durability signals. Half of what makes a discussion
   * visibly a different kind of thing from an archive entry.
   */
  test("a seeded thread renders its activity, not archive metadata", async () => {
    const { login, title, id, replyId } = await seedThread();
    await apiClient.acceptDiscussionAnswer(id, replyId);

    renderList(authedSession(login.user), `?q=${encodeURIComponent(title)}`);

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
    expect(screen.getByText(/1 条回复/)).toBeTruthy();
    expect(screen.getByText("已有采纳回答")).toBeTruthy();
    // Archive-only metadata must not appear on a discussion.
    expect(screen.queryByText(/第 1 版/)).toBeNull();
  });
});

describe("discussion detail page", () => {
  test("a discussion the viewer may not see renders not-found, not an error", async () => {
    renderDetail("00000000-0000-4000-8000-999999999999", guestSession);

    await waitFor(() => {
      expect(screen.getByText("讨论不存在或不可见")).toBeTruthy();
    });
    // A 404 must not be surfaced as a failure the user should retry.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("renders the thread and tells a guest what logging in adds", async () => {
    const { title, id, replyBody } = await seedThread();
    signOut();

    renderDetail(id, guestSession);

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
    expect(screen.getByText(replyBody)).toBeTruthy();
    expect(screen.getByText("登录后可以回复。")).toBeTruthy();
    expect(screen.queryByLabelText("写下你的回答")).toBeNull();
  });

  test("a reply is posted, the thread reloads, and the box is cleared", async () => {
    const { login, id } = await seedThread();

    renderDetail(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByLabelText("写下你的回答")).toBeTruthy();
    });

    // The submit control stays disabled until there is something to send.
    expect(
      (screen.getByRole("button", { name: "发表回复" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    type(
      screen.getByLabelText("写下你的回答") as HTMLTextAreaElement,
      "需要带学生证-独有。",
    );

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "发表回复" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "发表回复" }));

    await waitFor(() => {
      expect(screen.getByText("需要带学生证-独有。")).toBeTruthy();
    });
    // Cleared only after it succeeded.
    expect((screen.getByLabelText("写下你的回答") as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  /**
   * The server refuses replies on a closed thread, so the UI must not offer
   * one. Rendering a box that guarantees a 409 is worse than rendering none.
   */
  test("an archived thread stays readable but offers no reply box", async () => {
    const { login, title, id } = await seedThread();
    await apiClient.changeDiscussionStatus(id, "archived");

    renderDetail(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
    expect(screen.queryByLabelText("写下你的回答")).toBeNull();
    expect(
      screen.getAllByText(/讨论已结束，内容保留可读，但不再接受新回复/).length,
    ).toBeGreaterThan(0);
  });

  test("the asker can accept an answer and take it back", async () => {
    const { login, id } = await seedThread();

    renderDetail(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "标记为采纳回答" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "标记为采纳回答" }));

    await waitFor(() => {
      expect(screen.getByText("采纳回答")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "取消采纳" })).toBeTruthy();
  });

  test("a stranger is offered no accept control", async () => {
    const { title, id } = await seedThread();
    const stranger = await signIn("organization_member");

    renderDetail(id, authedSession(stranger.user));

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "标记为采纳回答" })).toBeNull();
  });
});

describe("the discussion-to-archive loop", () => {
  test("promoting a reply lands in the new draft's editor", async () => {
    const { login, id } = await seedThread();

    renderDetail(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /整理为资料/ }).length).toBe(2);
    });

    // The per-reply control, not the thread-level one.
    fireEvent.click(screen.getByRole("button", { name: "整理为资料" }));

    await waitFor(() => {
      expect(screen.getByText("资料编辑器")).toBeTruthy();
    });
  });

  /** The server requires a publicly readable source; a draft offers nothing. */
  test("a draft thread offers no promote control", async () => {
    const login = await signIn("student");
    const created = await apiClient.createDiscussion({
      title: "私密草稿-未发布",
      body: "还没想好",
      tags: [],
    });

    renderDetail(created.id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByText("私密草稿-未发布")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /整理为资料/ })).toBeNull();
  });

  test("a discussion lists the entries it produced", async () => {
    const { login, title, id } = await seedThread();
    const promoted = await apiClient.promoteDiscussion(id, {
      title: `${title}-指南`,
    });

    renderDetail(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByText("已沉淀的资料")).toBeTruthy();
    });
    // The promoter owns the draft, so its own author sees it listed.
    expect(screen.getByText(`${title}-指南`)).toBeTruthy();
    expect(promoted.entry.moderationStatus).toBe("draft");
  });

  test("a guest sees no derived draft, and the empty text explains the loop", async () => {
    const { title, id } = await seedThread();
    await apiClient.promoteDiscussion(id, { title: `${title}-未发布整理` });
    signOut();

    renderDetail(id, guestSession);

    await waitFor(() => {
      expect(screen.getByText("已沉淀的资料")).toBeTruthy();
    });
    expect(screen.queryByText(`${title}-未发布整理`)).toBeNull();
    expect(screen.getByText(/还没有被整理成资料/)).toBeTruthy();
  });

  /** The other half of the loop, on the archive entry. */
  test("an entry names the discussion it came from and who wrote the text", async () => {
    const { login, title, id, replyId } = await seedThread();
    const curator = await signIn("organization_member");
    const promoted = await apiClient.promoteDiscussion(id, {
      commentId: replyId,
      title: `${title}-指南`,
    });

    renderEntry(promoted.entry.id, authedSession(curator.user));

    await waitFor(() => {
      expect(screen.getByText("内容来源")).toBeTruthy();
    });
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(/整理自该讨论的一条回复/)).toBeTruthy();
    // Attribution survives promotion: the quoted text is the asker's reply,
    // and the entry belongs to the curator.
    expect(promoted.source.sourceAuthorId).toBe(login.user.id);
    expect(promoted.entry.authorId).toBe(curator.user.id);
  });

  test("an entry with no recorded source renders no source section", async () => {
    const login = await signIn("student");
    const entry = await apiClient.createKnowledgeEntry({
      title: "手写的资料-无来源",
      body: "不是从讨论整理来的。",
      tags: [],
      category: "other",
      applicableAudience: "all_students",
      sourceKind: "firsthand_experience",
    });

    renderEntry(entry.id, authedSession(login.user));

    await waitFor(() => {
      // By role: the archive page also lists the title in its revision
      // history, so a bare text query matches twice.
      expect(screen.getByRole("heading", { name: "手写的资料-无来源" })).toBeTruthy();
    });
    expect(screen.queryByText("内容来源")).toBeNull();
  });
});

describe("discussion editor page", () => {
  test("blocks submission until the required fields are filled", async () => {
    render(
      <MemoryRouter initialEntries={["/discussions/new"]}>
        <Routes>
          <Route path="/discussions/new" element={<DiscussionEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "创建讨论" }));

    await waitFor(() => {
      expect(screen.getByText("标题不能为空。")).toBeTruthy();
    });
    expect(screen.getByText("正文不能为空。")).toBeTruthy();
  });

  test("creating a discussion navigates to it", async () => {
    await signIn("student");

    render(
      <MemoryRouter initialEntries={["/discussions/new"]}>
        <Routes>
          <Route path="/discussions/new" element={<DiscussionEditorPage />} />
          <Route path="/discussions/:id" element={<p>讨论详情</p>} />
        </Routes>
      </MemoryRouter>,
    );

    type(screen.getByLabelText("标题") as HTMLInputElement, "食堂是不是涨价了-新");
    type(screen.getByLabelText("正文") as HTMLTextAreaElement, "今天买饭感觉贵了。");

    await waitFor(() => {
      expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe(
        "食堂是不是涨价了-新",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "创建讨论" }));

    await waitFor(() => {
      expect(screen.getByText("讨论详情")).toBeTruthy();
    });
  });

  /** A page must surface what the server actually said, not a generic retry. */
  test("an unauthenticated create surfaces the server's refusal", async () => {
    render(
      <MemoryRouter initialEntries={["/discussions/new"]}>
        <Routes>
          <Route path="/discussions/new" element={<DiscussionEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    type(screen.getByLabelText("标题") as HTMLInputElement, "无登录");
    type(screen.getByLabelText("正文") as HTMLTextAreaElement, "应该被拒绝。");

    await waitFor(() => {
      expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("无登录");
    });

    fireEvent.click(screen.getByRole("button", { name: "创建讨论" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("登录状态已失效");
    });
  });
});
