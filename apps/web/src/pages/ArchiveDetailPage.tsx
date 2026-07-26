import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { discussionDetailPath } from "../app/routes";
import { ArrowLeft, ICON_DEFAULTS } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
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
          action={<ButtonLink to="/archive">返回资料库</ButtonLink>}
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

  const { entry, revisions, corrections, sources } = state;
  // Frontend permission is an affordance only; the backend still decides.
  const canEdit =
    viewer !== undefined &&
    (viewer.id === entry.authorId ||
      viewer.systemRole === "moderator" ||
      viewer.systemRole === "admin");
  const canResolve = canEdit;
  const transitions = viewer
    ? allowedTransitions(entry.moderationStatus, {
        systemRole: viewer.systemRole,
        isAuthor: viewer.id === entry.authorId,
      })
    : [];

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
        {canEdit && <ButtonLink to={`/archive/${entry.id}/edit`}>编辑</ButtonLink>}
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

      {transitions.length > 0 && (
        <div className="actions">
          {transitions.map((status) => (
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

      {/* The archive half of the loop. The discussion shows what it produced;
          this shows where the content came from, and names whoever wrote the
          quoted text — that is not the entry's author when a reply was
          promoted, and losing the attribution would be the actual harm. */}
      {sources.length > 0 && (
        <section className="detailSection">
          <h2>内容来源</h2>
          <ul className="entryList">
            {sources.map((source) => (
              <Card
                as="li"
                key={`${source.sourcePostId}-${source.sourceCommentId ?? "post"}`}
              >
                <div className="entryHead">
                  <Link
                    className="entryTitle"
                    to={discussionDetailPath(source.sourcePostId)}
                  >
                    {source.sourceTitle}
                  </Link>
                </div>
                <p className="entryMeta">
                  {source.sourceCommentId
                    ? "整理自该讨论的一条回复"
                    : "整理自该讨论的主帖"}
                  {" · "}
                  内容作者{" "}
                  {source.sourceAuthorId === entry.authorId
                    ? "同本条目作者"
                    : source.sourceAuthorId}
                  {" · "}
                  整理于 {formatDateTime(source.createdAt)}
                </p>
              </Card>
            ))}
          </ul>
        </section>
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
                // Only clear on success: a failed submission that wiped the
                // textarea would lose what the reader typed.
                void controller.fileCorrection(correction).then((ok) => {
                  if (ok) {
                    setCorrection("");
                  }
                });
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
