import { CampusAgoraApiError, type ReportCategory } from "@campus-agora/api-client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { apiClient } from "../../../lib/api";
import { CATEGORY_OPTIONS } from "../labels";

/**
 * Reports any content, discussion or archive entry alike. Filing one does not
 * take the content down — it queues it for a moderator — and the copy says so,
 * because a reporter who expects an immediate takedown will report again.
 */
export function ReportPanel({
  postId,
  canReport,
}: {
  postId: string;
  canReport: boolean;
}) {
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [filed, setFiled] = useState(false);

  if (!canReport) {
    return <p className="entryMeta">登录后可以举报违规内容。</p>;
  }

  if (filed) {
    // `<output>` rather than a paragraph with role="status": the element
    // already carries the live-region semantics, so a screen reader announces
    // the result without the role being spelled out.
    return (
      <output className="entryMeta">
        举报已提交，审核者会尽快处理。内容在处理前仍然可见。
      </output>
    );
  }

  async function submit() {
    if (!message.trim()) {
      setError("请说明问题所在。");
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await apiClient.createReport({ postId, category, message: message.trim() });
      setFiled(true);
    } catch (caught) {
      // The server's own wording for a duplicate is the useful one: a generic
      // failure would leave the reporter trying again.
      setError(
        caught instanceof CampusAgoraApiError
          ? caught.code === "conflict"
            ? "你已经举报过这条内容，审核者正在处理。"
            : caught.code === "validation_failed"
              ? caught.message
              : caught.status === 401
                ? "登录状态已失效，请重新登录后再举报。"
                : "举报提交失败，请重试。"
          : "举报提交失败，请重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="reportForm"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Select
        id="report-category"
        label="举报类型"
        value={category}
        onChange={(event) => setCategory(event.target.value as ReportCategory)}
        options={CATEGORY_OPTIONS}
      />
      <Textarea
        id="report-message"
        label="问题说明"
        rows={3}
        placeholder="说明哪里违反了规则，越具体越有帮助"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />

      {error && (
        <p className="fieldError" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="danger"
        loading={submitting}
        disabled={message.trim().length === 0}
      >
        提交举报
      </Button>
    </form>
  );
}
