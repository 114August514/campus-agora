import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <section className="workspace">
      <EmptyState
        title="页面不存在"
        description="链接可能已经失效，或者内容已经被移动。"
        action={
          <Link to="/">
            <Button variant="primary">回到首页</Button>
          </Link>
        }
      />
    </section>
  );
}
