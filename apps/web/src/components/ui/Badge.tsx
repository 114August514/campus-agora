import type { ModerationStatus } from "@campus-agora/api-client";

const STATUS_LABELS: Record<ModerationStatus, string> = {
  draft: "草稿",
  published: "已发布",
  hidden: "已隐藏",
  rejected: "已退回",
};

const STATUS_TONES: Record<ModerationStatus, string> = {
  draft: "neutral",
  published: "success",
  hidden: "warning",
  rejected: "danger",
};

/**
 * The label carries the meaning on its own, so the status is never conveyed by
 * colour alone.
 */
export function Badge({ status }: { status: ModerationStatus }) {
  return (
    <span className={`badge badge-${STATUS_TONES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function statusLabel(status: ModerationStatus): string {
  return STATUS_LABELS[status];
}
