import type { ArchiveCategory } from "@campus-agora/api-client";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { useArchiveList } from "../features/archive/hooks/useArchiveList";
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
} from "../features/archive/labels";
import type { SessionController } from "../features/auth/useSession";
import { formatDateTime } from "../lib/format";

export function ArchiveListPage({ session }: { session: SessionController }) {
  const { state, filters, setFilter, setPage, reload } = useArchiveList();
  const canCreate = session.state.status === "authenticated";

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h1>资料库</h1>
          <p className="summary">
            校园经验的长期存档。资料可以被检索、更新、追溯版本，并由维护者持续修订。
          </p>
        </div>
        {canCreate && (
          <Link to="/archive/new">
            <Button variant="primary">创建资料</Button>
          </Link>
        )}
      </header>

      <div className="filters">
        <Input
          id="archive-q"
          label="搜索"
          placeholder="按标题或摘要搜索"
          value={filters.q}
          onChange={(event) => setFilter({ q: event.target.value })}
        />
        <Input
          id="archive-tag"
          label="标签"
          placeholder="例如：新生"
          value={filters.tag}
          onChange={(event) => setFilter({ tag: event.target.value })}
        />
        <Select
          id="archive-category"
          label="分类"
          value={filters.category}
          onChange={(event) =>
            setFilter({ category: event.target.value as ArchiveCategory | "" })
          }
          options={[{ value: "", label: "全部分类" }, ...CATEGORY_OPTIONS]}
        />
      </div>

      {state.status === "loading" && <LoadingState label="正在加载资料" />}

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={reload} />
      )}

      {state.status === "ready" && state.page.items.length === 0 && (
        <EmptyState
          title="没有匹配的资料"
          description={
            filters.q || filters.tag || filters.category
              ? "换一个关键词或清空筛选条件再试。"
              : "创建第一条资料，让经验被长期保存。"
          }
          action={
            canCreate ? (
              <Link to="/archive/new">
                <Button variant="primary">创建资料</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {state.status === "ready" && state.page.items.length > 0 && (
        <>
          <ul className="entryList">
            {state.page.items.map((entry) => (
              <Card as="li" key={entry.id}>
                <div className="entryHead">
                  <Link className="entryTitle" to={`/archive/${entry.id}`}>
                    {entry.title}
                  </Link>
                  <Badge status={entry.moderationStatus} />
                </div>
                {entry.summary && <p className="summary">{entry.summary}</p>}
                <p className="entryMeta">
                  {CATEGORY_LABELS[entry.category]} ·{" "}
                  {AUDIENCE_LABELS[entry.applicableAudience]} · 第{" "}
                  {entry.currentRevision} 版 · 更新于 {formatDateTime(entry.updatedAt)}
                </p>
                {entry.tags.length > 0 && (
                  <p className="entryTags">
                    {entry.tags.map((tag) => (
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
