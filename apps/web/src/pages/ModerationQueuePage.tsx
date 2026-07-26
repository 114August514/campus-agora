import type { ModerationQueueItem } from "@campus-agora/api-client";
import { useState } from "react";
import { Link } from "react-router-dom";
import { archiveDetailPath, discussionDetailPath } from "../app/routes";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Pagination } from "../components/ui/Pagination";
import { STATUS_LABELS } from "../features/archive/labels";
import type { SessionController } from "../features/auth/useSession";
import { useContentReports } from "../features/moderation/hooks/useContentReports";
import { useModerationQueue } from "../features/moderation/hooks/useModerationQueue";
import {
  CATEGORY_LABELS,
  RESOLUTION_LABELS,
  RISK_LABELS,
  RISK_TONES,
} from "../features/moderation/labels";
import { formatDateTime } from "../lib/format";

export function ModerationQueuePage({ session }: { session: SessionController }) {
  const { state, page, setPage, reload } = useModerationQueue();
  const [openItem, setOpenItem] = useState<string | undefined>();
  const viewer =
    session.state.status === "authenticated" ? session.state.user : undefined;

  if (state.status === "loading") {
    return <LoadingState label="正在加载审核队列" />;
  }

  // The server refuses the whole queue to non-moderators. Saying so is better
  // than an empty list, which reads as "nothing to review".
  if (state.status === "forbidden") {
    return (
      <section className="workspace">
        <EmptyState
          title="只有审核者可以打开审核队列"
          description={
            viewer ? "当前账号没有审核权限。" : "请使用具有审核权限的账号登录后再试。"
          }
        />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="workspace">
        <ErrorState message={state.message} onRetry={reload} />
      </section>
    );
  }

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h1>审核队列</h1>
          <p className="summary">
            等待处理的内容，风险最高的排在最前。举报本身不会下架内容——是否调整状态由你决定，
            每一次决定都会记入审计。
          </p>
        </div>
      </header>

      {state.page.items.length === 0 ? (
        <EmptyState
          title="队列是空的"
          description="没有待处理的举报，也没有等待复核的内容。"
        />
      ) : (
        <>
          <ul className="entryList">
            {state.page.items.map((item) => (
              <QueueRow
                key={item.postId}
                item={item}
                open={openItem === item.postId}
                onToggle={() =>
                  setOpenItem((current) =>
                    current === item.postId ? undefined : item.postId,
                  )
                }
                onResolved={reload}
              />
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

      {page > 1 && state.page.items.length === 0 && (
        <p className="entryMeta">这一页已经空了，返回第一页看看。</p>
      )}
    </section>
  );
}

function QueueRow({
  item,
  open,
  onToggle,
  onResolved,
}: {
  item: ModerationQueueItem;
  open: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const reports = useContentReports(open ? item.postId : undefined);
  const target =
    item.postKind === "knowledge"
      ? archiveDetailPath(item.postId)
      : discussionDetailPath(item.postId);

  return (
    <Card as="li">
      <div className="entryHead">
        <Link className="entryTitle" to={target}>
          {item.title}
        </Link>
        {/* Risk carries the urgency, always with its label rather than by
            colour alone. */}
        <span className={`badge badge-${RISK_TONES[item.risk]}`}>
          风险：{RISK_LABELS[item.risk]}
        </span>
      </div>
      <p className="entryMeta">
        {item.postKind === "knowledge" ? "资料" : "讨论"} ·{" "}
        {STATUS_LABELS[item.moderationStatus]} · {item.openReportCount} 条未处理举报 ·
        进入队列于 {formatDateTime(item.queuedAt)}
      </p>

      <div className="actions">
        <Button onClick={onToggle}>{open ? "收起举报" : "查看举报"}</Button>
      </div>

      {open && (
        <div className="reportPanel">
          {reports.state.status === "loading" && (
            <LoadingState label="正在加载举报详情" />
          )}
          {reports.state.status === "error" && (
            <ErrorState message={reports.state.message} onRetry={reports.load} />
          )}
          {reports.actionError && (
            <p className="fieldError" role="alert">
              {reports.actionError}
            </p>
          )}
          {reports.state.status === "ready" && (
            <ul className="entryList">
              {reports.state.reports.map((report) => (
                <Card as="li" key={report.id}>
                  <p className="entryMeta">
                    {CATEGORY_LABELS[report.category]} · 提交于{" "}
                    {formatDateTime(report.createdAt)}
                    {report.resolvedAt
                      ? ` · 已处理（${
                          report.resolution
                            ? RESOLUTION_LABELS[
                                report.resolution as keyof typeof RESOLUTION_LABELS
                              ]
                            : "已处理"
                        }）`
                      : " · 待处理"}
                  </p>
                  <p className="entryBody">{report.message}</p>
                  {!report.resolvedAt && (
                    <div className="actions">
                      <Button
                        variant="danger"
                        loading={reports.actionPending}
                        onClick={() =>
                          void reports
                            .resolve(report.id, "upheld")
                            .then((ok) => ok && onResolved())
                        }
                      >
                        确认属实
                      </Button>
                      <Button
                        loading={reports.actionPending}
                        onClick={() =>
                          void reports
                            .resolve(report.id, "dismissed")
                            .then((ok) => ok && onResolved())
                        }
                      >
                        驳回
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </ul>
          )}
          {/* Resolving records a finding. Changing what the campus sees is a
              separate, deliberate act on the content itself. */}
          <p className="entryMeta">
            处理举报只记录结论。要调整内容状态，请打开内容页面并选择相应操作。
          </p>
        </div>
      )}
    </Card>
  );
}
