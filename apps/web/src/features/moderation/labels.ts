import type { ReportCategory, RiskLevel } from "@campus-agora/api-client";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  spam: "垃圾信息",
  harassment: "人身攻击",
  privacy_violation: "隐私泄露",
  misinformation: "不实信息",
  illegal: "违法违规",
  other: "其他",
};

export const CATEGORY_OPTIONS = (
  Object.entries(CATEGORY_LABELS) as Array<[ReportCategory, string]>
).map(([value, label]) => ({ value, label }));

export const RISK_LABELS: Record<RiskLevel, string> = {
  none: "待审",
  low: "低",
  medium: "中",
  high: "高",
};

/**
 * The badge tone for a queue item. Risk is the reason a reviewer looks at one
 * thing before another, so it is the one place colour carries urgency — always
 * alongside the text label, never instead of it.
 */
export const RISK_TONES: Record<RiskLevel, string> = {
  none: "neutral",
  low: "info",
  medium: "warning",
  high: "danger",
};

export const RESOLUTION_LABELS = {
  upheld: "确认属实",
  dismissed: "驳回",
} as const;
