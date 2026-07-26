import {
  CampusAgoraApiError,
  type PaginatedDiscussions,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../../../lib/api";

export interface DiscussionFilters {
  q: string;
  tag: string;
  page: number;
}

export type DiscussionListState =
  | { status: "loading" }
  | { status: "ready"; page: PaginatedDiscussions }
  | { status: "error"; message: string };

export interface DiscussionListController {
  state: DiscussionListState;
  filters: DiscussionFilters;
  /** Filters live in the URL so a filtered list can be linked and shared. */
  setFilter: (patch: Partial<Omit<DiscussionFilters, "page">>) => void;
  setPage: (page: number) => void;
  reload: () => void;
}

function messageForLoadError(error: unknown): string {
  if (!(error instanceof CampusAgoraApiError)) {
    return "讨论加载失败，请重试。";
  }

  if (error.code === "network_error") {
    return "无法连接后端服务，请确认 API 已启动后重试。";
  }

  // Retrying a 401 without logging in again can never succeed.
  if (error.status === 401) {
    return "登录状态已失效，请重新登录后重试。";
  }

  return "讨论加载失败，请重试。";
}

function readFilters(params: URLSearchParams): DiscussionFilters {
  const page = Number(params.get("page") ?? "1");

  return {
    q: params.get("q") ?? "",
    tag: params.get("tag") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function useDiscussionList(): DiscussionListController {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<DiscussionListState>({ status: "loading" });
  // A sequence number rather than a cancellation flag, so a slow response from
  // a previous filter can never overwrite a newer one.
  const latestRequest = useRef(0);
  const filters = readFilters(params);
  const { q, tag, page } = filters;

  const load = useCallback(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setState({ status: "loading" });

    apiClient
      .listDiscussions({ q: q || undefined, tag: tag || undefined, page })
      .then((result) => {
        if (requestId === latestRequest.current) {
          setState({ status: "ready", page: result });
        }
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequest.current) {
          return;
        }

        setState({ status: "error", message: messageForLoadError(error) });
      });
  }, [q, tag, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = useCallback(
    (patch: Partial<Omit<DiscussionFilters, "page">>) => {
      const next = new URLSearchParams(params);

      for (const [key, value] of Object.entries(patch)) {
        if (value) {
          next.set(key, String(value));
        } else {
          next.delete(key);
        }
      }

      // A narrowed result set can be shorter than the current page, so a
      // filter change always returns to the first page.
      next.delete("page");
      setParams(next);
    },
    [params, setParams],
  );

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

  return { state, filters, setFilter, setPage, reload: load };
}
