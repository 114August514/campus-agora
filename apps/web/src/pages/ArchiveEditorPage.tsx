import {
  type ApplicableAudience,
  type ArchiveCategory,
  CampusAgoraApiError,
  type SourceKind,
} from "@campus-agora/api-client";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import {
  AUDIENCE_OPTIONS,
  CATEGORY_OPTIONS,
  SOURCE_OPTIONS,
} from "../features/archive/labels";
import { apiClient } from "../lib/api";

interface DraftForm {
  title: string;
  summary: string;
  body: string;
  tags: string;
  category: ArchiveCategory;
  applicableAudience: ApplicableAudience;
  sourceKind: SourceKind;
  sourceReference: string;
}

const EMPTY_FORM: DraftForm = {
  title: "",
  summary: "",
  body: "",
  tags: "",
  category: "other",
  applicableAudience: "all_students",
  sourceKind: "unspecified",
  sourceReference: "",
};

export function ArchiveEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof DraftForm, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiClient
      .getKnowledgeEntry(id)
      .then((entry) => {
        if (cancelled) {
          return;
        }

        setForm({
          title: entry.title,
          summary: entry.summary ?? "",
          body: entry.body,
          tags: entry.tags.join("，"),
          category: entry.category,
          applicableAudience: entry.applicableAudience,
          sourceKind: entry.sourceKind,
          sourceReference: entry.sourceReference ?? "",
        });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("资料加载失败，请重试。");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function update<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof DraftForm, string>> = {};

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

    // Tags accept both Chinese and ASCII separators, because the editor is
    // used with a Chinese IME.
    const tags = form.tags
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: form.title,
      body: form.body,
      summary: form.summary || undefined,
      tags,
      category: form.category,
      applicableAudience: form.applicableAudience,
      sourceKind: form.sourceKind,
      sourceReference: form.sourceReference || undefined,
    };

    try {
      const entry = id
        ? await apiClient.updateKnowledgeEntry(id, payload)
        : await apiClient.createKnowledgeEntry(payload);
      navigate(`/archive/${entry.id}`);
    } catch (error) {
      setSubmitError(messageForSubmitError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState label="正在加载资料" />;
  }

  if (loadError) {
    return (
      <section className="workspace">
        <ErrorState message={loadError} />
      </section>
    );
  }

  return (
    <section className="workspace">
      <h1>{isEdit ? "编辑资料" : "创建资料"}</h1>

      {submitError && (
        <p className="fieldError" role="alert">
          {submitError}
        </p>
      )}

      <form
        className="editorForm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          id="entry-title"
          label="标题"
          value={form.title}
          error={fieldErrors.title}
          onChange={(event) => update("title", event.target.value)}
        />
        <Input
          id="entry-summary"
          label="摘要"
          hint="一句话说明这份资料解决什么问题，可留空。"
          value={form.summary}
          onChange={(event) => update("summary", event.target.value)}
        />
        <Textarea
          id="entry-body"
          label="正文"
          value={form.body}
          error={fieldErrors.body}
          onChange={(event) => update("body", event.target.value)}
        />
        <Input
          id="entry-tags"
          label="标签"
          hint="用逗号分隔，最多 10 个。"
          value={form.tags}
          onChange={(event) => update("tags", event.target.value)}
        />
        <div className="filters">
          <Select
            id="entry-category"
            label="分类"
            value={form.category}
            onChange={(event) =>
              update("category", event.target.value as ArchiveCategory)
            }
            options={CATEGORY_OPTIONS}
          />
          <Select
            id="entry-audience"
            label="适用对象"
            value={form.applicableAudience}
            onChange={(event) =>
              update("applicableAudience", event.target.value as ApplicableAudience)
            }
            options={AUDIENCE_OPTIONS}
          />
          <Select
            id="entry-source"
            label="来源类型"
            value={form.sourceKind}
            onChange={(event) => update("sourceKind", event.target.value as SourceKind)}
            options={SOURCE_OPTIONS}
          />
        </div>
        <Input
          id="entry-source-reference"
          label="来源引用"
          hint="原始通知链接或出处说明，可留空。"
          value={form.sourceReference}
          onChange={(event) => update("sourceReference", event.target.value)}
        />

        <div className="actions">
          <Button type="submit" variant="primary" loading={submitting}>
            {isEdit ? "保存修改" : "创建草稿"}
          </Button>
          <Link to={id ? `/archive/${id}` : "/archive"}>
            <Button variant="ghost">取消</Button>
          </Link>
        </div>
      </form>
    </section>
  );
}

function messageForSubmitError(error: unknown): string {
  if (!(error instanceof CampusAgoraApiError)) {
    return "保存失败，请重试。";
  }

  switch (error.code) {
    case "unauthorized":
      return "登录状态已失效，请重新登录后再保存。";
    case "forbidden":
      return "你没有权限编辑这份资料。";
    case "validation_failed":
      return error.message;
    default:
      return "保存失败，请检查网络后重试。";
  }
}
