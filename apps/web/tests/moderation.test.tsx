import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setSessionToken } from "../src/features/auth/session";
import { apiClient as typedClient } from "../src/lib/api";
import { ArchiveDetailPage } from "../src/pages/ArchiveDetailPage";
import { DiscussionDetailPage } from "../src/pages/DiscussionDetailPage";
import { ModerationQueuePage } from "../src/pages/ModerationQueuePage";

/**
 * These drive the real moderation pages through the typed mock fetch, which
 * enforces the same rules the server does. Everything is imported statically
 * and shares one store, because the pages import `lib/api` by its plain path;
 * fixtures stay independent by using a distinct title each.
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

/** A published discussion with one reply, titled uniquely per fixture. */
async function seedThread() {
  seedCounter += 1;
  const title = `待审内容-${seedCounter}`;
  const login = await signIn("student");
  const created = await apiClient.createDiscussion({
    title,
    body: `正文（${seedCounter}）`,
    tags: [],
  });
  await apiClient.changeDiscussionStatus(created.id, "published");
  await apiClient.replyToDiscussion(created.id, `一条回复（${seedCounter}）`);

  return { login, title, id: created.id };
}

const guestSession = { state: { status: "guest" } } as never;

function authedSession(user: unknown) {
  return { state: { status: "authenticated", user } } as never;
}

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

function renderQueue(session: unknown, search = "") {
  return render(
    <MemoryRouter initialEntries={[`/moderation${search}`]}>
      <Routes>
        <Route path="/moderation" element={<ModerationQueuePage session={session} />} />
        <Route path="/archive/:id" element={<p>资料详情</p>} />
        <Route path="/discussions/:id" element={<p>讨论详情</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDiscussion(id: string, session: unknown) {
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

beforeEach(signOut);

afterEach(() => {
  cleanup();
  signOut();
});

describe("the moderation queue", () => {
  /**
   * The server refuses the whole queue to a non-moderator. An empty list would
   * read as "nothing to review", which is a different and wrong claim.
   */
  test("a non-moderator is told they cannot review, not shown an empty queue", async () => {
    const login = await signIn("student");

    renderQueue(authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByText("只有审核者可以打开审核队列")).toBeTruthy();
    });
    expect(screen.queryByText("队列是空的")).toBeNull();
  });

  test("a moderator with nothing to review sees the empty state", async () => {
    const login = await signIn("moderator");

    renderQueue(authedSession(login.user), "?page=99");

    await waitFor(() => {
      expect(screen.getByText("队列是空的")).toBeTruthy();
    });
  });

  test("a reported item is queued with its risk and open-report count", async () => {
    const { title, id } = await seedThread();
    await apiClient.createReport({
      postId: id,
      category: "illegal",
      message: "涉及违法内容",
    });

    const moderator = await signIn("moderator");
    renderQueue(authedSession(moderator.user));

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
    // Risk is shown with its label, never by colour alone.
    expect(screen.getAllByText(/风险：高/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 条未处理举报/)).toBeTruthy();
  });

  test("a reviewer can open an item, read its reports, and dismiss one", async () => {
    const { title, id } = await seedThread();
    await apiClient.createReport({
      postId: id,
      category: "spam",
      message: "这条内容看起来是广告-独有",
    });

    const moderator = await signIn("moderator");
    renderQueue(authedSession(moderator.user));

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });

    // Scoped to this fixture's own row: the queue is shared across tests in
    // this file, and the worst-first ordering means index 0 is whichever item
    // happens to be riskiest, not necessarily this one.
    const row = screen.getByText(title).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "查看举报" }));

    await waitFor(() => {
      expect(within(row).getByText("这条内容看起来是广告-独有")).toBeTruthy();
    });
    expect(within(row).getByText(/垃圾信息/)).toBeTruthy();

    fireEvent.click(within(row).getByRole("button", { name: "驳回" }));

    // The item leaves the queue once nothing is open on it.
    await waitFor(() => {
      expect(screen.queryByText(title)).toBeNull();
    });
  });

  /**
   * Resolving records a finding. Changing what the campus sees is a separate,
   * deliberate act — this is the rule that stops a report being a takedown.
   */
  test("resolving a report does not change the content's status", async () => {
    const { id } = await seedThread();
    const report = await apiClient.createReport({
      postId: id,
      category: "harassment",
      message: "人身攻击",
    });

    const moderator = await signIn("moderator");
    await apiClient.resolveContentReport(id, report.id, "upheld");

    const discussion = await apiClient.getDiscussion(id);
    expect(discussion.moderationStatus).toBe("published");
    expect(moderator.user.systemRole).toBe("moderator");
  });
});

describe("reporting content", () => {
  test("a guest is told what logging in adds", async () => {
    const { id } = await seedThread();
    signOut();

    renderDiscussion(id, guestSession);

    await waitFor(() => {
      expect(screen.getByText("登录后可以举报违规内容。")).toBeTruthy();
    });
    expect(screen.queryByLabelText("问题说明")).toBeNull();
  });

  test("a report is filed and the content stays visible", async () => {
    const { login, title, id } = await seedThread();

    renderDiscussion(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByLabelText("问题说明")).toBeTruthy();
    });

    // The submit control stays disabled until there is something to send.
    expect(
      (screen.getByRole("button", { name: "提交举报" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    type(
      screen.getByLabelText("问题说明") as HTMLTextAreaElement,
      "泄露了同学的手机号",
    );

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "提交举报" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() => {
      expect(screen.getByText(/举报已提交/)).toBeTruthy();
    });
    // The rule that matters most: reporting is not a takedown.
    expect(screen.getByText(title)).toBeTruthy();
    expect((await apiClient.getDiscussion(id)).moderationStatus).toBe("published");
  });

  test("a duplicate report surfaces the server's reason, not a generic failure", async () => {
    const { login, id } = await seedThread();
    await apiClient.createReport({ postId: id, category: "spam", message: "第一次" });

    renderDiscussion(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByLabelText("问题说明")).toBeTruthy();
    });

    type(screen.getByLabelText("问题说明") as HTMLTextAreaElement, "第二次");
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "提交举报" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("你已经举报过这条内容");
    });
  });
});

describe("AI drafting in the UI", () => {
  /**
   * `AI_ARCHIVE_ENABLED` is off by default, so the control has to be absent
   * rather than present-and-failing.
   */
  test("the draft action is absent when the capability is off", async () => {
    const { login, id } = await seedThread();

    renderDiscussion(id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /将主帖整理为资料/ })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /用归档助手起草/ })).toBeNull();
  });

  /**
   * Traceability made visible: an entry a provider composed says so where it
   * is read, and a hand-written one does not — which is what makes the marker
   * mean anything.
   */
  test("a composed entry is labelled and a hand-written one is not", async () => {
    const login = await signIn("student");

    const handWritten = await apiClient.createKnowledgeEntry({
      title: "手写的资料-M4",
      body: "正文",
      tags: [],
      category: "other",
      applicableAudience: "all_students",
      sourceKind: "firsthand_experience",
    });

    renderEntry(handWritten.id, authedSession(login.user));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "手写的资料-M4" })).toBeTruthy();
    });
    expect(screen.queryByText(/AI 起草/)).toBeNull();
  });
});
