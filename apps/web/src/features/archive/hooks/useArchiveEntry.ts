import {
  CampusAgoraApiError,
  type Correction,
  type KnowledgeEntry,
  type ModerationStatus,
  type Revision,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/api";

export type ArchiveEntryState =
  | { status: "loading" }
  | {
      status: "ready";
      entry: KnowledgeEntry;
      revisions: Revision[];
      corrections: Correction[];
    }
  /** A missing entry and an entry the caller may not see are the same state:
   * the API answers 404 for both so a private draft does not leak. */
  | { status: "notFound" }
  | { status: "error"; message: string };

export interface ArchiveEntryController {
  state: ArchiveEntryState;
  reload: () => void;
  changeStatus: (status: ModerationStatus) => Promise<void>;
  fileCorrection: (message: string) => Promise<void>;
  resolveCorrection: (correctionId: string) => Promise<void>;
  actionError: string | undefined;
  actionPending: boolean;
}

export function useArchiveEntry(id: string): ArchiveEntryController {
  const [state, setState] = useState<ArchiveEntryState>({ status: "loading" });
  // A sequence number rather than a cancellation flag, so a stale response can
  // never overwrite a newer one after a reload.
  const latestRequest = useRef(0);
  const [actionError, setActionError] = useState<string | undefined>();
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setState({ status: "loading" });

    Promise.all([
      apiClient.getKnowledgeEntry(id),
      apiClient.listKnowledgeEntryRevisions(id),
      apiClient.listKnowledgeEntryCorrections(id),
    ])
      .then(([entry, revisions, corrections]) => {
        if (requestId === latestRequest.current) {
          setState({
            status: "ready",
            entry,
            revisions: revisions.items,
            corrections: corrections.items,
          });
        }
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequest.current) {
          return;
        }

        if (error instanceof CampusAgoraApiError && error.status === 404) {
          setState({ status: "notFound" });
          return;
        }

        setState({ status: "error", message: "资料加载失败，请重试。" });
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, fallback: string) => {
      setActionPending(true);
      setActionError(undefined);

      try {
        await action();
        load();
      } catch (error) {
        setActionError(
          error instanceof CampusAgoraApiError
            ? messageForActionError(error, fallback)
            : fallback,
        );
      } finally {
        setActionPending(false);
      }
    },
    [load],
  );

  return {
    state,
    reload: load,
    actionError,
    actionPending,
    changeStatus: useCallback(
      (status: ModerationStatus) =>
        runAction(
          () => apiClient.changeKnowledgeEntryStatus(id, status),
          "状态更新失败，请重试。",
        ),
      [id, runAction],
    ),
    fileCorrection: useCallback(
      (message: string) =>
        runAction(
          () => apiClient.fileKnowledgeEntryCorrection(id, message),
          "纠错提交失败，请重试。",
        ),
      [id, runAction],
    ),
    resolveCorrection: useCallback(
      (correctionId: string) =>
        runAction(
          () => apiClient.resolveKnowledgeEntryCorrection(id, correctionId),
          "纠错处理失败，请重试。",
        ),
      [id, runAction],
    ),
  };
}

function messageForActionError(error: CampusAgoraApiError, fallback: string): string {
  switch (error.code) {
    case "unauthorized":
      return "登录状态已失效，请重新登录。";
    case "forbidden":
      return "你没有权限执行该操作。";
    case "conflict":
      return "该状态变更不被允许，请刷新后重试。";
    case "validation_failed":
      return error.message;
    default:
      return fallback;
  }
}
