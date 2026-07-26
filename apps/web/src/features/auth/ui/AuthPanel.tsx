import type { MockPersona } from "@campus-agora/api-client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { PERSONA_OPTIONS, roleLabel } from "../labels";
import type { SessionController } from "../useSession";

export function AuthPanel({ session }: { session: SessionController }) {
  const [persona, setPersona] = useState<MockPersona>("student");
  const { state } = session;

  if (state.status === "loading") {
    return <div className="authPanel">正在检查登录状态…</div>;
  }

  if (state.status === "authenticated") {
    return (
      <div className="authPanel">
        <span className="authName">{state.user.displayName}</span>
        <span className="authRole">{roleLabel(state.user.systemRole)}</span>
        <Button onClick={() => void session.logout()}>退出登录</Button>
      </div>
    );
  }

  return (
    <div className="authPanel">
      {state.status === "error" && (
        <span className="authError" role="alert">
          {state.message}
        </span>
      )}
      <label className="authPersona">
        <span>模拟身份</span>
        <select
          className="authSelect"
          value={persona}
          onChange={(event) => setPersona(event.target.value as MockPersona)}
        >
          {PERSONA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" onClick={() => void session.login(persona)}>
        模拟校园登录
      </Button>
    </div>
  );
}
