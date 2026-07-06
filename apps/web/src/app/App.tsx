import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";

export function App() {
  return (
    <AppShell
      title="Campus Agora"
      sidebarItems={["资料库", "讨论", "归档助手", "审核"]}
    >
      <section className="workspace">
        <div>
          <p className="eyebrow">校园公共知识广场</p>
          <h1>资料沉淀与开放讨论的工作台</h1>
          <p className="summary">
            M0 当前只提供应用壳、设计 token
            和后端状态入口，完整业务流程将在后续里程碑中推进。
          </p>
        </div>
        <div className="actions">
          <Button variant="primary">查看后端状态</Button>
          <Button variant="secondary">打开设计系统</Button>
        </div>
      </section>
    </AppShell>
  );
}
