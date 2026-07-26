import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { roleLabel } from "../features/auth/labels";
import type { SessionController } from "../features/auth/useSession";
import { formatDateTime } from "../lib/format";

export function HomePage({ session }: { session: SessionController }) {
  const { state } = session;

  return (
    <section className="workspace">
      <div>
        <p className="eyebrow">校园公共知识广场</p>
        <h1>资料沉淀与开放讨论的工作台</h1>
        <p className="summary">
          把散落在群聊和公众号里的校园经验，沉淀成可检索、可更新、可追溯的公共资料。
        </p>
      </div>

      <Card>
        <h2>登录状态</h2>
        {state.status === "loading" && <p>正在检查登录状态…</p>}
        {state.status === "error" && (
          <p className="fieldError" role="alert">
            {state.message}
          </p>
        )}
        {state.status === "guest" && (
          <p>当前是访客模式，可以浏览已发布资料，登录后可以创建和维护资料。</p>
        )}
        {state.status === "authenticated" && (
          <>
            <p>
              已认证：<strong>{state.user.displayName}</strong>（
              {roleLabel(state.user.systemRole)}）
            </p>
            <p>会话有效期至 {formatDateTime(state.expiresAt)}。</p>
          </>
        )}
      </Card>

      <div className="actions">
        <Link to="/archive">
          <Button variant="primary">浏览资料库</Button>
        </Link>
        <Link to="/design-system">
          <Button variant="secondary">打开设计系统</Button>
        </Link>
      </div>
    </section>
  );
}
