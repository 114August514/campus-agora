import {
  CampusAgoraApiError,
  type DerivedEntry,
  type Discussion,
  type DiscussionReply,
  type ModerationStatus,
  type PromoteRequest,
  type Promotion,
} from "@campus-agora/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/api";

export type DiscussionState =
  | { status: "loading" }
  | {
      status: "ready";
      discussion: Discussion;
      replies: DiscussionReply[];
      /** The archive entries this thread produced, filtered to what the
       * reader may see — a draft entry is listed only to its owner. */
      derivedEntries: DerivedEntry[];
    }
  /** A missing discussion and one the caller may not see are the same state:
   * the API answers 404 for both so a private draft does not leak. */
  | { status: "notFound" }
  | { status: "error"; message: string };

export interface DiscussionController {
  state: DiscussionState;
  reload: () => void;
  /// Each resolves to whether the action succeeded, so callers can keep the
  /// user's input when it did not.
  reply: (body: string) => Promise<boolean>;
  acceptAnswer: (commentId: string | null) => Promise<boolean>;
  changeStatus: (status: ModerationStatus) => Promise<boolean>;
  /// Resolves to the created promotion so the caller can navigate to the new
  /// draft, or undefined when it failed.
  promote: (body: PromoteRequest) => Promise<Promotion | undefined>;
  actionError: string | undefined;
  actionPending: boolean;
}

export function useDiscussion(id: string): DiscussionController {
  const [state, setState] = useState<DiscussionState>({ status: "loading" });
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
      apiClient.getDiscussion(id),
      apiClient.listDiscussionReplies(id),
      apiClient.listDiscussionDerivedEntries(id),
    ])
      .then(([discussion, replies, derived]) => {
        if (requestId === latestRequest.current) {
          setState({
            status: "ready",
            discussion,
            replies: replies.items,
            derivedEntries: derived.items,
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

        // A 401 means the session expired; retrying without logging in again
        // can never succeed, so say what actually helps.
        setState({
          status: "error",
          message:
            error instanceof CampusAgoraApiError && error.status === 401
              ? "登录状态已失效，请重新登录后重试。"
              : "讨论加载失败，请重试。",
        });
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async <T>(action: () => Promise<T>, fallback: string): Promise<T | undefined> => {
      setActionPending(true);
      setActionError(undefined);

      try {
        const result = await action();
        load();
        return result;
      } catch (error) {
        setActionError(
          error instanceof CampusAgoraApiError
            ? messageForActionError(error, fallback)
            : fallback,
        );
        return undefined;
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
    reply: useCallback(
      async (body: string) =>
        (await runAction(
          () => apiClient.replyToDiscussion(id, body),
          "回复提交失败，请重试。",
        )) !== undefined,
      [id, runAction],
    ),
    acceptAnswer: useCallback(
      async (commentId: string | null) =>
        (await runAction(
          () => apiClient.acceptDiscussionAnswer(id, commentId),
          "标记最佳回答失败，请重试。",
        )) !== undefined,
      [id, runAction],
    ),
    changeStatus: useCallback(
      async (status: ModerationStatus) =>
        (await runAction(
          () => apiClient.changeDiscussionStatus(id, status),
          "状态更新失败，请重试。",
        )) !== undefined,
      [id, runAction],
    ),
    promote: useCallback(
      (body: PromoteRequest) =>
        runAction(
          () => apiClient.promoteDiscussion(id, body),
          "整理为资料失败，请重试。",
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
      return "该操作在当前状态下不被允许，请刷新后重试。";
    case "not_found":
      return "目标内容已不存在，请刷新后重试。";
    case "validation_failed":
      return error.message;
    default:
      return fallback;
  }
}
