import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <section className="workspace">
      <EmptyState
        title="页面不存在"
        description="链接可能已经失效，或者内容已经被移动。"
        action={
          <ButtonLink to="/" variant="primary">
            回到首页
          </ButtonLink>
        }
      />
    </section>
  );
}
