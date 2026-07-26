import {
  CampusAgoraApiError,
  type CurrentUser,
  type MockPersona,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/api";
import { getSessionToken, setSessionToken } from "./session";

export type SessionState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; user: CurrentUser; expiresAt: string }
  | { status: "error"; message: string };

export interface SessionController {
  state: SessionState;
  login: (persona: MockPersona) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof CampusAgoraApiError && error.status === 401;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof CampusAgoraApiError && error.code === "auth_mock_disabled") {
    return "模拟校园登录未启用，请检查后端配置。";
  }

  if (error instanceof CampusAgoraApiError && error.code === "network_error") {
    return "无法连接后端服务，请确认 API 已启动后重试。";
  }

  return fallback;
}

export function useSession(): SessionController {
  const [state, setState] = useState<SessionState>(() =>
    getSessionToken() ? { status: "loading" } : { status: "guest" },
  );

  const refresh = useCallback(async () => {
    if (!getSessionToken()) {
      setState({ status: "guest" });
      return;
    }

    setState({ status: "loading" });

    try {
      const session = await apiClient.getAuthSession();
      setState({
        status: "authenticated",
        user: session.user,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      if (isUnauthorized(error)) {
        setSessionToken(undefined);
        setState({ status: "guest" });
        return;
      }

      setState({
        status: "error",
        message: errorMessage(error, "无法获取登录状态，请重试。"),
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (persona: MockPersona) => {
    setState({ status: "loading" });

    try {
      const outcome = await apiClient.mockLogin(persona);
      setSessionToken(outcome.token);
      setState({
        status: "authenticated",
        user: outcome.user,
        expiresAt: outcome.expiresAt,
      });
    } catch (error) {
      setSessionToken(undefined);
      setState({
        status: "error",
        message: errorMessage(error, "登录失败，请稍后重试。"),
      });
    }
  }, []);

  const logout = useCallback(async () => {
    setState({ status: "loading" });

    try {
      await apiClient.logout();
    } catch (error) {
      // Losing the server call is acceptable: the local token is dropped and
      // the server session ages out through its expiry.
      if (!isUnauthorized(error)) {
        console.warn("logout request failed", error);
      }
    } finally {
      setSessionToken(undefined);
      setState({ status: "guest" });
    }
  }, []);

  return { state, login, logout, refresh };
}
