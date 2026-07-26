import { CampusAgoraApiError, type DiscussionReply } from "@campus-agora/api-client";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ROUTES, archiveDetailPath, archiveEditPath } from "../app/routes";
import { ArrowLeft, Check, ICON_DEFAULTS, Sprout } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Textarea } from "../components/ui/Textarea";
import { STATUS_LABELS } from "../features/archive/labels";
import type { SessionController } from "../features/auth/useSession";
import { useDiscussion } from "../features/discussion/hooks/useDiscussion";
import {
  DISCUSSION_STATUS_HINTS,
  DISCUSSION_TRANSITION_LABELS,
  acceptsReplies,
  allowedDiscussionTransitions,
  boundedTitle,
  canPromote,
} from "../features/discussion/labels";
import { useCapabilities } from "../features/meta/useCapabilities";
import { ReportPanel } from "../features/moderation/ui/ReportPanel";
import { apiClient } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function DiscussionDetailPage({ session }: { session: SessionController }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const controller = useDiscussion(id);
  const capabilities = useCapabilities();
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>();
  const { state } = controller;
  const viewer =
    session.state.status === "authenticated" ? session.state.user : undefined;

  if (state.status === "loading") {
    return <LoadingState label="正在加载讨论" />;
  }

  if (state.status === "notFound") {
    return (
      <section className="workspace">
        <EmptyState
          title="讨论不存在或不可见"
          description="它可能尚未发布、已被隐藏，或者你没有查看权限。"
          action={<ButtonLink to={ROUTES.discussionList}>返回讨论区</ButtonLink>}
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

  const { discussion, replies, derivedEntries } = state;
  const isAuthor = viewer?.id === discussion.authorId;
  // Frontend permission is an affordance only; the backend still decides.
  const canAccept =
    viewer !== undefined &&
    (isAuthor || viewer.systemRole === "moderator" || viewer.systemRole === "admin");
  const transitions = viewer
    ? allowedDiscussionTransitions(discussion.moderationStatus, {
        systemRole: viewer.systemRole,
        isAuthor: isAuthor ?? false,
      })
    : [];
  // The server requires a publicly readable source, so a draft or hidden
  // thread offers no promote control at all rather than one that 409s.
  const promotable = viewer !== undefined && canPromote(discussion.moderationStatus);
  const open = acceptsReplies(discussion.moderationStatus);

  async function generateDraft() {
    setDraftError(undefined);

    try {
      const drafted = await apiClient.generateAiDraft(id);
      // Composed text is the start of curating, not the end. The entry is a
      // draft the requester owns, so send them where they can correct it.
      navigate(archiveEditPath(drafted.entry.id));
    } catch (error) {
      setDraftError(
        error instanceof CampusAgoraApiError && error.code === "forbidden"
          ? "归档助手当前不可用。"
          : "起草失败，请重试。",
      );
    }
  }

  async function promote(commentId: string | null, title: string) {
    const promotion = await controller.promote({
      commentId,
      title: boundedTitle(title),
    });

    // Promotion is the start of curating, not the end: the new entry is a
    // draft the promoter owns, so send them where they can finish it.
    if (promotion) {
      navigate(archiveEditPath(promotion.entry.id));
    }
  }

  return (
    <section className="workspace">
      <Link className="backLink" to={ROUTES.discussionList}>
        <ArrowLeft {...ICON_DEFAULTS} size={16} aria-hidden="true" />
        返回讨论区
      </Link>

      <header className="pageHeader">
        <div>
          <div className="entryHead">
            <h1>{discussion.title}</h1>
            <Badge status={discussion.moderationStatus} />
          </div>
          <p className="entryMeta">
            {discussion.replyCount} 条回复 · 最后活动于{" "}
            {formatDateTime(discussion.updatedAt)}
          </p>
          {/* What this state means for the reader, in this content kind's own
              words: `archived` on a thread is "closed", not "superseded". */}
          <p className="statusHint">
            {DISCUSSION_STATUS_HINTS[discussion.moderationStatus]}
          </p>
        </div>
      </header>

      {(controller.actionError || draftError) && (
        <p className="fieldError" role="alert">
          {controller.actionError ?? draftError}
        </p>
      )}

      <Card>
        <p className="entryBody">{discussion.body}</p>
      </Card>

      {discussion.tags.length > 0 && (
        <p className="entryTags">
          {discussion.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </p>
      )}

      <div className="actions">
        {transitions.map((status) => (
          <Button
            key={status}
            variant={status === "published" ? "primary" : "secondary"}
            loading={controller.actionPending}
            onClick={() => void controller.changeStatus(status)}
          >
            {DISCUSSION_TRANSITION_LABELS[status]}
          </Button>
        ))}
        {promotable && (
          <Button
            loading={controller.actionPending}
            onClick={() => void promote(null, discussion.title)}
          >
            <Sprout {...ICON_DEFAULTS} size={16} aria-hidden="true" />
            将主帖整理为资料
          </Button>
        )}
        {/* Absent, not present-and-failing, when the server does not have the
            capability. */}
        {promotable && capabilities.aiArchiveEnabled && (
          <Button
            loading={controller.actionPending}
            onClick={() => void generateDraft()}
          >
            <Sprout {...ICON_DEFAULTS} size={16} aria-hidden="true" />
            用归档助手起草
          </Button>
        )}
      </div>

      <section className="detailSection">
        <h2>回复</h2>
        {replies.length === 0 ? (
          <EmptyState
            title="还没有回复"
            description={
              open ? "第一个回答往往最有价值。" : "这个讨论没有收到回复就已结束。"
            }
          />
        ) : (
          <ul className="entryList">
            {replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                accepted={discussion.acceptedCommentId === reply.id}
                canAccept={canAccept}
                promotable={promotable}
                pending={controller.actionPending}
                onAccept={(next) => void controller.acceptAnswer(next)}
                onPromote={() =>
                  void promote(reply.id, `${discussion.title}（整理自回复）`)
                }
              />
            ))}
          </ul>
        )}

        {open && viewer && (
          <form
            className="replyForm"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) {
                // Only clear on success: a failed submission that wiped the
                // textarea would lose what the reader typed.
                void controller.reply(draft).then((ok) => {
                  if (ok) {
                    setDraft("");
                  }
                });
              }
            }}
          >
            <Textarea
              id="discussion-reply"
              label="写下你的回答"
              rows={4}
              placeholder="分享你知道的流程、经验或线索"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              loading={controller.actionPending}
              disabled={draft.trim().length === 0}
            >
              发表回复
            </Button>
          </form>
        )}

        {open && !viewer && <p className="entryMeta">登录后可以回复。</p>}
        {!open && (
          <p className="entryMeta">
            {DISCUSSION_STATUS_HINTS[discussion.moderationStatus]}
          </p>
        )}
      </section>

      <section className="detailSection">
        <h2>举报违规</h2>
        <ReportPanel postId={discussion.id} canReport={viewer !== undefined} />
      </section>

      {/* One half of the loop. The other half lives on the archive entry,
          which names this thread as its source. */}
      <section className="detailSection">
        <h2>已沉淀的资料</h2>
        {derivedEntries.length === 0 ? (
          <p className="entryMeta">
            这个讨论还没有被整理成资料。有长期价值的回答可以用上面的「整理为资料」
            按钮沉淀下来，资料会保留指向本帖的来源链接。
          </p>
        ) : (
          <ul className="entryList">
            {derivedEntries.map((entry) => (
              <Card as="li" key={entry.entryId}>
                <div className="entryHead">
                  <Link className="entryTitle" to={archiveDetailPath(entry.entryId)}>
                    {entry.title}
                  </Link>
                  <Badge status={entry.moderationStatus} />
                </div>
                <p className="entryMeta">
                  整理于 {formatDateTime(entry.createdAt)} ·{" "}
                  {STATUS_LABELS[entry.moderationStatus]}
                </p>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function ReplyCard({
  reply,
  accepted,
  canAccept,
  promotable,
  pending,
  onAccept,
  onPromote,
}: {
  reply: DiscussionReply;
  accepted: boolean;
  canAccept: boolean;
  promotable: boolean;
  pending: boolean;
  onAccept: (commentId: string | null) => void;
  onPromote: () => void;
}) {
  return (
    <Card as="li">
      <div className="entryHead">
        <p className="entryMeta">回复于 {formatDateTime(reply.createdAt)}</p>
        {accepted && (
          <span className="acceptedMark">
            <Check {...ICON_DEFAULTS} size={16} aria-hidden="true" />
            采纳回答
          </span>
        )}
      </div>
      <p className="entryBody">{reply.body}</p>
      {(canAccept || promotable) && (
        <div className="actions">
          {canAccept && (
            <Button
              loading={pending}
              onClick={() => onAccept(accepted ? null : reply.id)}
            >
              {accepted ? "取消采纳" : "标记为采纳回答"}
            </Button>
          )}
          {promotable && (
            <Button loading={pending} onClick={onPromote}>
              <Sprout {...ICON_DEFAULTS} size={16} aria-hidden="true" />
              整理为资料
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
