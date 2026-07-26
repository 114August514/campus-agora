import {
  type ArchiveCategory,
  CampusAgoraApiError,
  type PaginatedKnowledgeEntries,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../../../lib/api";

export interface ArchiveFilters {
  q: string;
  tag: string;
  category: ArchiveCategory | "";
  page: number;
}

export type ArchiveListState =
  | { status: "loading" }
  | { status: "ready"; page: PaginatedKnowledgeEntries }
  | { status: "error"; message: string };

export interface ArchiveListController {
  state: ArchiveListState;
  filters: ArchiveFilters;
  /** Filters live in the URL so a filtered list can be linked and shared. */
  setFilter: (patch: Partial<Omit<ArchiveFilters, "page">>) => void;
  setPage: (page: number) => void;
  reload: () => void;
}

function readFilters(params: URLSearchParams): ArchiveFilters {
  const page = Number(params.get("page") ?? "1");

  return {
    q: params.get("q") ?? "",
    tag: params.get("tag") ?? "",
    category: (params.get("category") as ArchiveCategory | null) ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function useArchiveList(): ArchiveListController {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<ArchiveListState>({ status: "loading" });
  // A sequence number rather than a cancellation flag, so a slow response from
  // a previous filter can never overwrite a newer one.
  const latestRequest = useRef(0);
  const filters = readFilters(params);
  const { q, tag, category, page } = filters;

  const load = useCallback(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setState({ status: "loading" });

    apiClient
      .listKnowledgeEntries({
        q: q || undefined,
        tag: tag || undefined,
        category: category || undefined,
        page,
      })
      .then((result) => {
        if (requestId === latestRequest.current) {
          setState({ status: "ready", page: result });
        }
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequest.current) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof CampusAgoraApiError && error.code === "network_error"
              ? "无法连接后端服务，请确认 API 已启动后重试。"
              : "资料加载失败，请重试。",
        });
      });
  }, [q, tag, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = useCallback(
    (patch: Partial<Omit<ArchiveFilters, "page">>) => {
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

  return {
    state,
    filters,
    setFilter,
    setPage,
    reload: load,
  };
}
