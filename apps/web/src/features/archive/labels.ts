import type {
  ApplicableAudience,
  ArchiveCategory,
  CurrentUser,
  ModerationStatus,
  SourceKind,
} from "@campus-agora/api-client";

/**
 * UI copy lives here rather than inside deep components, so a future
 * localization pass has one place to move.
 */
export const CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  onboarding: "入学指引",
  campus_life: "校园生活",
  academics: "学业",
  organizations: "社团组织",
  procedures: "办事流程",
  other: "其他",
};

export const AUDIENCE_LABELS: Record<ApplicableAudience, string> = {
  all_students: "全体学生",
  new_students: "新生",
  undergraduate: "本科生",
  graduate: "研究生",
  organization_members: "组织成员",
};

export const SOURCE_LABELS: Record<SourceKind, string> = {
  firsthand_experience: "亲历经验",
  official_announcement: "官方通知",
  group_chat: "群聊记录",
  discussion: "站内讨论",
  unspecified: "未标注",
};

export const STATUS_LABELS: Record<ModerationStatus, string> = {
  draft: "草稿",
  published: "已发布",
  hidden: "已隐藏",
  rejected: "已退回",
  archived: "已归档",
  pending_review: "待审核",
};

function toOptions<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({
    value,
    label,
  }));
}

export const CATEGORY_OPTIONS = toOptions(CATEGORY_LABELS);
export const AUDIENCE_OPTIONS = toOptions(AUDIENCE_LABELS);
export const SOURCE_OPTIONS = toOptions(SOURCE_LABELS);

/** Transitions the state machine allows, mirroring crates/domain. */
const TRANSITIONS: Record<ModerationStatus, ModerationStatus[]> = {
  draft: ["published", "rejected", "pending_review"],
  published: ["hidden", "archived", "pending_review"],
  hidden: ["published"],
  rejected: ["draft"],
  archived: ["published", "hidden"],
  // A reviewer decides. Archiving or hiding content still under review would
  // settle the open question by side effect.
  pending_review: ["published", "rejected", "draft"],
};

export const TRANSITION_LABELS: Record<ModerationStatus, string> = {
  draft: "退回草稿",
  published: "发布",
  hidden: "隐藏",
  rejected: "退回",
  archived: "归档",
  pending_review: "提交审核",
};

/// Mirrors the backend rule: an author may publish their own draft, and every
/// other transition is a moderation action. Offering a button the server will
/// reject is worse than offering none.
export function allowedTransitions(
  from: ModerationStatus,
  viewer: { systemRole: CurrentUser["systemRole"]; isAuthor: boolean },
): ModerationStatus[] {
  const isModeration =
    viewer.systemRole === "moderator" || viewer.systemRole === "admin";

  if (isModeration) {
    return TRANSITIONS[from];
  }

  if (!viewer.isAuthor) {
    return [];
  }

  // An author may publish their own draft, and may retire or restore their own
  // published work — archiving leaves it readable and is reversible. Hiding
  // stays a moderation action.
  // An author may publish their own draft, or ask for review instead when
  // they are unsure. Submitting asks for less than publishing does.
  if (from === "draft") {
    return ["published", "pending_review"];
  }

  if (from === "published") {
    return ["archived"];
  }

  if (from === "archived") {
    return ["published"];
  }

  return [];
}
