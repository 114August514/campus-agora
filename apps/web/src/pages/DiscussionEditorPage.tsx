import { CampusAgoraApiError } from "@campus-agora/api-client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, discussionDetailPath } from "../app/routes";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { apiClient } from "../lib/api";

interface DiscussionForm {
  title: string;
  body: string;
  tags: string;
}

const EMPTY_FORM: DiscussionForm = { title: "", body: "", tags: "" };

/**
 * Creating a discussion only. A thread's opening post is a question rather
 * than maintained knowledge, so there is no edit flow: the backend has no
 * update endpoint, and offering a form the server cannot accept would be a
 * dead end. Content worth maintaining becomes an archive entry instead.
 */
export function DiscussionEditorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<DiscussionForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof DiscussionForm, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Partial<Record<keyof DiscussionForm, string>> = {};

    if (!form.title.trim()) {
      errors.title = "标题不能为空。";
    }

    if (!form.body.trim()) {
      errors.body = "正文不能为空。";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const created = await apiClient.createDiscussion({
        title: form.title.trim(),
        body: form.body.trim(),
        tags: form.tags
          .split(/[,，\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      navigate(discussionDetailPath(created.id));
    } catch (error) {
      // The server's own message is the useful one for a validation failure;
      // anything else gets wording the reader can act on.
      setSubmitError(
        error instanceof CampusAgoraApiError
          ? error.code === "validation_failed"
            ? error.message
            : error.code === "unauthorized"
              ? "登录状态已失效，请重新登录后再发布。"
              : "发起讨论失败，请重试。"
          : "发起讨论失败，请重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h1>发起讨论</h1>
          <p className="summary">
            讨论创建后先是草稿，只有你能看到；发布之后其他人才能阅读和回复。
          </p>
        </div>
      </header>

      <form
        className="editorForm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          id="discussion-title"
          label="标题"
          placeholder="用一句话说清你想问什么"
          value={form.title}
          error={fieldErrors.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Textarea
          id="discussion-body"
          label="正文"
          rows={8}
          placeholder="补充背景：你已经试过什么，卡在哪一步"
          value={form.body}
          error={fieldErrors.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
        />
        <Input
          id="discussion-tags"
          label="标签"
          placeholder="用逗号分隔，例如：办事流程，新生"
          value={form.tags}
          onChange={(event) => setForm({ ...form, tags: event.target.value })}
        />

        {submitError && (
          <p className="fieldError" role="alert">
            {submitError}
          </p>
        )}

        <div className="actions">
          <Button type="submit" variant="primary" loading={submitting}>
            创建讨论
          </Button>
          <ButtonLink to={ROUTES.discussionList} variant="ghost">
            取消
          </ButtonLink>
        </div>
      </form>
    </section>
  );
}
