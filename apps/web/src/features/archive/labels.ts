import type {
  ApplicableAudience,
  ArchiveCategory,
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
  draft: ["published", "rejected"],
  published: ["hidden"],
  hidden: ["published"],
  rejected: ["draft"],
};

export const TRANSITION_LABELS: Record<ModerationStatus, string> = {
  draft: "退回草稿",
  published: "发布",
  hidden: "隐藏",
  rejected: "退回",
};

export function allowedTransitions(from: ModerationStatus): ModerationStatus[] {
  return TRANSITIONS[from];
}
