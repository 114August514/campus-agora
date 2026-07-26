import type { CurrentUser, ModerationStatus } from "@campus-agora/api-client";

/**
 * A discussion and an archive entry share a moderation vocabulary but not its
 * meaning. `archived` on an entry means "superseded"; on a thread it means
 * "closed, and its value has been captured elsewhere". Reusing the archive's
 * wording would tell the reader the wrong thing.
 */
export const DISCUSSION_STATUS_LABELS: Record<ModerationStatus, string> = {
  draft: "草稿",
  published: "进行中",
  hidden: "已隐藏",
  rejected: "已退回",
  archived: "已归档",
};

export const DISCUSSION_STATUS_HINTS: Record<ModerationStatus, string> = {
  draft: "只有你能看到，发布后其他人才能回复。",
  published: "任何人都可以阅读，登录后可以回复。",
  hidden: "已被审核隐藏，仅作者与审核者可见。",
  rejected: "已被退回，可以修改后重新发布。",
  archived: "讨论已结束，内容保留可读，但不再接受新回复。",
};

/** Transitions the state machine allows, mirroring crates/domain. */
const TRANSITIONS: Record<ModerationStatus, ModerationStatus[]> = {
  draft: ["published", "rejected"],
  published: ["hidden", "archived"],
  hidden: ["published"],
  rejected: ["draft"],
  archived: ["published", "hidden"],
};

export const DISCUSSION_TRANSITION_LABELS: Record<ModerationStatus, string> = {
  draft: "退回草稿",
  published: "发布",
  hidden: "隐藏",
  rejected: "退回",
  archived: "结束讨论",
};

/**
 * Mirrors the backend matrix: an author may publish their own draft and may
 * close or reopen their own thread, because archiving leaves it readable and
 * is reversible. Hiding stays a moderation action. Offering a button the
 * server will reject is worse than offering none.
 */
export function allowedDiscussionTransitions(
  from: ModerationStatus,
  viewer: { systemRole: CurrentUser["systemRole"]; isAuthor: boolean },
): ModerationStatus[] {
  if (viewer.systemRole === "moderator" || viewer.systemRole === "admin") {
    return TRANSITIONS[from];
  }

  if (!viewer.isAuthor) {
    return [];
  }

  if (from === "draft") {
    return ["published"];
  }

  if (from === "published") {
    return ["archived"];
  }

  if (from === "archived") {
    return ["published"];
  }

  return [];
}

/**
 * Whether the server will accept a promotion. It requires a *publicly
 * readable* source, not merely one this reader can see, so that publishing the
 * resulting entry can never republish content that was deliberately not
 * public.
 */
export function canPromote(status: ModerationStatus): boolean {
  return status === "published" || status === "archived";
}

/** Whether the thread is still collecting answers. */
export function acceptsReplies(status: ModerationStatus): boolean {
  return status === "published";
}

/**
 * `TITLE_MAX_CHARS` from `crates/domain/src/archive.rs`. A promoted title is
 * derived from the thread's, which may itself be at the limit, so the derived
 * one has to be trimmed to fit. Sending an over-long title produced a 422 the
 * reader could not act on — there is no field to shorten it in — which made
 * the promote button permanently dead for long-titled threads.
 */
export const TITLE_MAX_CHARS = 200;

export function boundedTitle(title: string): string {
  const characters = [...title.trim()];

  return characters.length <= TITLE_MAX_CHARS
    ? characters.join("")
    : `${characters.slice(0, TITLE_MAX_CHARS - 1).join("")}…`;
}
