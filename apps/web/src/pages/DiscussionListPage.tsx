import { Link } from "react-router-dom";
import { ROUTES, discussionDetailPath } from "../app/routes";
import { Check, ICON_DEFAULTS, MessageSquare } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Pagination } from "../components/ui/Pagination";
import type { SessionController } from "../features/auth/useSession";
import { useDiscussionList } from "../features/discussion/hooks/useDiscussionList";
import { formatDateTime } from "../lib/format";

export function DiscussionListPage({ session }: { session: SessionController }) {
  const { state, filters, setFilter, setPage, reload } = useDiscussionList();
  const canCreate = session.state.status === "authenticated";

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h1>讨论</h1>
          {/* The product's organizing principle, said where someone reads it:
              discussion is open, and what turns out to be durable moves. */}
          <p className="summary">
            校园话题的开放交流。讨论本身是短期的，其中有长期价值的回答可以被整理成资料，
            并保留指向原帖的来源链接。
          </p>
        </div>
        {canCreate && (
          <ButtonLink to={ROUTES.discussionNew} variant="primary">
            发起讨论
          </ButtonLink>
        )}
      </header>

      <div className="filters">
        <Input
          id="discussion-q"
          label="搜索"
          placeholder="按标题或正文搜索"
          value={filters.q}
          onChange={(event) => setFilter({ q: event.target.value })}
        />
        <Input
          id="discussion-tag"
          label="标签"
          placeholder="例如：办事流程"
          value={filters.tag}
          onChange={(event) => setFilter({ tag: event.target.value })}
        />
      </div>

      {state.status === "loading" && <LoadingState label="正在加载讨论" />}

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={reload} />
      )}

      {state.status === "ready" && state.page.items.length === 0 && (
        <EmptyState
          title="没有匹配的讨论"
          description={
            filters.q || filters.tag
              ? "换一个关键词或清空筛选条件再试。"
              : "提出第一个问题，让别人的经验有地方回答。"
          }
          action={
            canCreate ? (
              <ButtonLink to={ROUTES.discussionNew} variant="primary">
                发起讨论
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      {state.status === "ready" && state.page.items.length > 0 && (
        <>
          <ul className="entryList">
            {state.page.items.map((discussion) => (
              <Card as="li" key={discussion.id}>
                <div className="entryHead">
                  <Link className="entryTitle" to={discussionDetailPath(discussion.id)}>
                    {discussion.title}
                  </Link>
                  <Badge status={discussion.moderationStatus} />
                </div>
                <p className="summary">{discussion.body}</p>
                {/* Activity signals, not durability signals: a thread is
                    judged by whether it is being answered, an archive entry by
                    whether it is still accurate. */}
                <p className="entryMeta">
                  <span className="metaFact">
                    <MessageSquare {...ICON_DEFAULTS} size={14} aria-hidden="true" />
                    {discussion.replyCount} 条回复
                  </span>
                  {discussion.acceptedCommentId && (
                    <span className="metaFact metaFact-accepted">
                      <Check {...ICON_DEFAULTS} size={14} aria-hidden="true" />
                      已有采纳回答
                    </span>
                  )}
                  <span className="metaFact">
                    最后活动于 {formatDateTime(discussion.updatedAt)}
                  </span>
                </p>
                {discussion.tags.length > 0 && (
                  <p className="entryTags">
                    {discussion.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </p>
                )}
              </Card>
            ))}
          </ul>
          <Pagination
            page={state.page.page}
            pageSize={state.page.pageSize}
            totalItems={state.page.totalItems}
            totalPages={state.page.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
