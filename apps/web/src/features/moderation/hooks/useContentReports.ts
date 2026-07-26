import {
  CampusAgoraApiError,
  type ContentReport,
  type ReportResolution,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/api";

export type ContentReportsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; reports: ContentReport[] }
  | { status: "error"; message: string };

export interface ContentReportsController {
  state: ContentReportsState;
  load: () => void;
  /// Resolves to whether it succeeded, so the caller can keep the panel open
  /// and show why when it did not.
  resolve: (reportId: string, resolution: ReportResolution) => Promise<boolean>;
  actionError: string | undefined;
  actionPending: boolean;
}

/** The reports filed against one piece of content. Moderator-only. */
export function useContentReports(id: string | undefined): ContentReportsController {
  const [state, setState] = useState<ContentReportsState>({ status: "idle" });
  const latestRequest = useRef(0);
  const [actionError, setActionError] = useState<string | undefined>();
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(() => {
    if (!id) {
      setState({ status: "idle" });
      return;
    }

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setState({ status: "loading" });

    apiClient
      .listContentReports(id)
      .then((result) => {
        if (requestId === latestRequest.current) {
          setState({ status: "ready", reports: result.items });
        }
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequest.current) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof CampusAgoraApiError && error.status === 403
              ? "只有审核者可以查看举报详情。"
              : "举报详情加载失败，请重试。",
        });
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (reportId: string, resolution: ReportResolution) => {
      if (!id) {
        return false;
      }

      setActionPending(true);
      setActionError(undefined);

      try {
        await apiClient.resolveContentReport(id, reportId, resolution);
        load();
        return true;
      } catch (error) {
        setActionError(
          error instanceof CampusAgoraApiError && error.code === "not_found"
            ? "该举报已不存在，请刷新后重试。"
            : "处理失败，请重试。",
        );
        return false;
      } finally {
        setActionPending(false);
      }
    },
    [id, load],
  );

  return { state, load, resolve, actionError, actionPending };
}
