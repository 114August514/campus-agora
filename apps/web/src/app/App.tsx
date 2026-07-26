import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { roleLabel } from "../features/auth/labels";
import { visibleNavigationItems } from "../features/auth/navigation";
import { AuthPanel } from "../features/auth/ui/AuthPanel";
import { useSession } from "../features/auth/useSession";
import { formatDateTime } from "../lib/format";

function SessionStatusCard({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const { state } = session;

  if (state.status === "loading") {
    return (
      <section className="statusCard" aria-live="polite">
        <h2>登录状态</h2>
        <p>正在检查登录状态…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="statusCard" aria-live="polite">
        <h2>登录状态</h2>
        <p className="authError">{state.message}</p>
        <div className="actions">
          <Button onClick={() => void session.refresh()}>重试</Button>
        </div>
      </section>
    );
  }

  if (state.status === "guest") {
    return (
      <section className="statusCard" aria-live="polite">
        <h2>登录状态</h2>
        <p>当前是访客模式，只能读取公开内容。</p>
        <p className="summary">
          使用右上角的模拟校园登录可以体验学生、组织成员、审核员和管理员的认证态。
        </p>
      </section>
    );
  }

  return (
    <section className="statusCard" aria-live="polite">
      <h2>登录状态</h2>
      <p>
        已认证：<strong>{state.user.displayName}</strong>（
        {roleLabel(state.user.systemRole)}）
      </p>
      <p>会话有效期至 {formatDateTime(state.expiresAt)}。</p>
      {state.user.organizations.length > 0 ? (
        <p>
          组织身份：
          {state.user.organizations.map((membership) => membership.name).join("、")}
        </p>
      ) : (
        <p>未加入任何组织。</p>
      )}
    </section>
  );
}

export function App() {
  const session = useSession();
  const currentUser =
    session.state.status === "authenticated" ? session.state.user : undefined;

  return (
    <AppShell
      title="Campus Agora"
      sidebarItems={visibleNavigationItems(currentUser)}
      topbarContent={<AuthPanel session={session} />}
    >
      <section className="workspace">
        <div>
          <p className="eyebrow">校园公共知识广场</p>
          <h1>资料沉淀与开放讨论的工作台</h1>
          <p className="summary">
            M1
            提供模拟校园登录、会话与权限边界。完整的资料库与讨论业务将在后续里程碑中推进。
          </p>
        </div>
        <SessionStatusCard session={session} />
        <div className="actions">
          <Button variant="primary">查看后端状态</Button>
          <Button variant="secondary">打开设计系统</Button>
        </div>
      </section>
    </AppShell>
  );
}
