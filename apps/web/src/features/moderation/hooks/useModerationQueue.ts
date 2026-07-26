import {
  CampusAgoraApiError,
  type PaginatedModerationQueue,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../../../lib/api";

export type ModerationQueueState =
  | { status: "loading" }
  | { status: "ready"; page: PaginatedModerationQueue }
  /** The server refuses the whole queue to non-moderators, and the page says
   * so rather than showing an empty list that looks like "nothing to do". */
  | { status: "forbidden" }
  | { status: "error"; message: string };

export interface ModerationQueueController {
  state: ModerationQueueState;
  page: number;
  setPage: (page: number) => void;
  reload: () => void;
}

export function useModerationQueue(): ModerationQueueController {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<ModerationQueueState>({ status: "loading" });
  // A sequence number rather than a cancellation flag, so a slow response from
  // a previous page can never overwrite a newer one.
  const latestRequest = useRef(0);

  const parsed = Number(params.get("page") ?? "1");
  const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  const load = useCallback(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setState({ status: "loading" });

    apiClient
      .listModerationQueue({ page })
      .then((result) => {
        if (requestId === latestRequest.current) {
          setState({ status: "ready", page: result });
        }
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequest.current) {
          return;
        }

        if (error instanceof CampusAgoraApiError && error.status === 403) {
          setState({ status: "forbidden" });
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof CampusAgoraApiError && error.status === 401
              ? "登录状态已失效，请重新登录后重试。"
              : "审核队列加载失败，请重试。",
        });
      });
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const setPage = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(params);

      if (nextPage <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(nextPage));
      }

      setParams(next);
    },
    [params, setParams],
  );

  return { state, page, setPage, reload: load };
}
