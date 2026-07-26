import type { ModerationStatus } from "@campus-agora/api-client";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { CATEGORY_OPTIONS } from "../features/archive/labels";

const STATUSES: ModerationStatus[] = [
  "draft",
  "published",
  "hidden",
  "rejected",
  "archived",
];

/**
 * The manual visual-regression entry point. Every primitive and every product
 * state renders here, so a change that breaks one is visible in one place.
 */
export function DesignSystemPage() {
  return (
    <section className="workspace">
      <div>
        <p className="eyebrow">设计系统</p>
        <h1>组件与状态一览</h1>
        <p className="summary">
          新增页面前先在这里确认组件、状态和主题表现，避免页面各自实现一套基础控件。
        </p>
      </div>

      <section className="detailSection">
        <h2>按钮</h2>
        <div className="actions">
          <Button variant="primary">主操作</Button>
          <Button variant="secondary">次操作</Button>
          <Button variant="ghost">弱操作</Button>
          <Button variant="danger">危险操作</Button>
          <Button loading>加载中</Button>
          <Button disabled>不可用</Button>
        </div>
        {/* Navigation that looks like a button. One `<a>`, not a `<button>`
            inside a link — that nesting is invalid HTML and costs a keyboard
            user two tab stops for one action. */}
        <div className="actions">
          <ButtonLink to="/archive" variant="primary">
            主操作链接
          </ButtonLink>
          <ButtonLink to="/discussions">次操作链接</ButtonLink>
        </div>
      </section>

      <section className="detailSection">
        <h2>表单</h2>
        <div className="filters">
          <Input id="ds-input" label="输入框" placeholder="请输入" defaultValue="" />
          <Input
            id="ds-input-error"
            label="输入框（错误）"
            error="标题不能为空。"
            defaultValue=""
          />
          <Select
            id="ds-select"
            label="下拉选择"
            defaultValue="onboarding"
            options={CATEGORY_OPTIONS}
          />
        </div>
        <Textarea id="ds-textarea" label="多行文本" rows={4} defaultValue="" />
      </section>

      <section className="detailSection">
        <h2>状态标签</h2>
        <div className="actions">
          {STATUSES.map((status) => (
            <Badge key={status} status={status} />
          ))}
        </div>
      </section>

      <section className="detailSection">
        <h2>卡片</h2>
        <Card>
          <p className="entryTitle">卡片标题</p>
          <p className="summary">
            卡片用于独立内容单元或列表项，不作为页面区块包裹层。
          </p>
        </Card>
      </section>

      <section className="detailSection">
        <h2>加载、空、错误与未授权状态</h2>
        <LoadingState label="正在加载资料" />
        <EmptyState
          title="还没有资料"
          description="创建第一条资料，让经验被长期保存。"
          action={<Button variant="primary">创建资料</Button>}
        />
        <ErrorState message="资料加载失败，请重试。" onRetry={() => {}} />
        <EmptyState
          title="需要登录"
          description="登录后才能创建和维护资料。"
          action={<Button>去登录</Button>}
        />
        <EmptyState
          title="没有权限"
          description="你没有权限查看这份资料，可以联系维护者获取访问方式。"
        />
      </section>

      <section className="detailSection">
        <h2>分页</h2>
        <Pagination
          page={2}
          pageSize={20}
          totalItems={45}
          totalPages={3}
          onPageChange={() => {}}
        />
      </section>
    </section>
  );
}
