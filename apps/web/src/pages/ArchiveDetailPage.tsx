import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ICON_DEFAULTS } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Textarea } from "../components/ui/Textarea";
import { useArchiveEntry } from "../features/archive/hooks/useArchiveEntry";
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  SOURCE_LABELS,
  TRANSITION_LABELS,
  allowedTransitions,
} from "../features/archive/labels";
import type { SessionController } from "../features/auth/useSession";
import { formatDateTime } from "../lib/format";

export function ArchiveDetailPage({ session }: { session: SessionController }) {
  const { id = "" } = useParams();
  const controller = useArchiveEntry(id);
  const [correction, setCorrection] = useState("");
  const { state } = controller;
  const viewer =
    session.state.status === "authenticated" ? session.state.user : undefined;

  if (state.status === "loading") {
    return <LoadingState label="正在加载资料" />;
  }

  if (state.status === "notFound") {
    return (
      <section className="workspace">
        <EmptyState
          title="资料不存在或不可见"
          description="它可能尚未发布、已被隐藏，或者你没有查看权限。"
          action={
            <Link to="/archive">
              <Button>返回资料库</Button>
            </Link>
          }
        />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="workspace">
        <ErrorState message={state.message} onRetry={controller.reload} />
      </section>
    );
  }

  const { entry, revisions, corrections } = state;
  // Frontend permission is an affordance only; the backend still decides.
  const canEdit =
    viewer !== undefined &&
    (viewer.id === entry.authorId ||
      viewer.systemRole === "moderator" ||
      viewer.systemRole === "admin");
  const canResolve = canEdit;

  return (
    <section className="workspace">
      <Link className="backLink" to="/archive">
        <ArrowLeft {...ICON_DEFAULTS} size={16} aria-hidden="true" />
        返回资料库
      </Link>

      <header className="pageHeader">
        <div>
          <div className="entryHead">
            <h1>{entry.title}</h1>
            <Badge status={entry.moderationStatus} />
          </div>
          <p className="entryMeta">
            {CATEGORY_LABELS[entry.category]} ·{" "}
            {AUDIENCE_LABELS[entry.applicableAudience]} · 来源：
            {SOURCE_LABELS[entry.sourceKind]} · 第 {entry.currentRevision} 版 · 更新于{" "}
            {formatDateTime(entry.updatedAt)}
          </p>
        </div>
        {canEdit && (
          <Link to={`/archive/${entry.id}/edit`}>
            <Button>编辑</Button>
          </Link>
        )}
      </header>

      {controller.actionError && (
        <p className="fieldError" role="alert">
          {controller.actionError}
        </p>
      )}

      {entry.summary && <p className="summary">{entry.summary}</p>}
      <Card>
        <p className="entryBody">{entry.body}</p>
      </Card>

      {entry.sourceReference && (
        <p className="entryMeta">来源引用：{entry.sourceReference}</p>
      )}

      {canEdit && allowedTransitions(entry.moderationStatus).length > 0 && (
        <div className="actions">
          {allowedTransitions(entry.moderationStatus).map((status) => (
            <Button
              key={status}
              variant={status === "published" ? "primary" : "secondary"}
              loading={controller.actionPending}
              onClick={() => void controller.changeStatus(status)}
            >
              {TRANSITION_LABELS[status]}
            </Button>
          ))}
        </div>
      )}

      <section className="detailSection">
        <h2>版本历史</h2>
        <ul className="entryList">
          {revisions.map((revision) => (
            <Card as="li" key={revision.id}>
              <p className="entryTitle">
                第 {revision.revision} 版 · {formatDateTime(revision.createdAt)}
              </p>
              <p className="summary">{revision.title}</p>
            </Card>
          ))}
        </ul>
      </section>

      <section className="detailSection">
        <h2>纠错</h2>
        {corrections.length === 0 ? (
          <EmptyState
            title="暂无纠错"
            description="如果内容已经过期或有误，可以在下方提交纠错。"
          />
        ) : (
          <ul className="entryList">
            {corrections.map((item) => (
              <Card as="li" key={item.id}>
                <p className="summary">{item.message}</p>
                <p className="entryMeta">
                  提交于 {formatDateTime(item.createdAt)}
                  {item.resolvedAt
                    ? ` · 已处理于 ${formatDateTime(item.resolvedAt)}`
                    : " · 待处理"}
                </p>
                {!item.resolvedAt && canResolve && (
                  <div className="actions">
                    <Button
                      loading={controller.actionPending}
                      onClick={() => void controller.resolveCorrection(item.id)}
                    >
                      标记为已处理
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </ul>
        )}

        {viewer ? (
          <form
            className="correctionForm"
            onSubmit={(event) => {
              event.preventDefault();
              if (correction.trim()) {
                void controller
                  .fileCorrection(correction)
                  .then(() => setCorrection(""));
              }
            }}
          >
            <Textarea
              id="correction-message"
              label="提交纠错"
              rows={4}
              placeholder="说明哪里已经过期或有误"
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              loading={controller.actionPending}
              disabled={correction.trim().length === 0}
            >
              提交纠错
            </Button>
          </form>
        ) : (
          <p className="entryMeta">登录后可以提交纠错。</p>
        )}
      </section>
    </section>
  );
}
