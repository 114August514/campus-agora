import {
  type DiscoveryResponse,
  type DiscoveryStreamOptions,
  discoverSourcesProgress,
} from "@campus-agora/api-client";

export interface DiscoveryRunState {
  query: string;
  phase: "idle" | "running" | "complete" | "cancelled" | "limit_reached" | "failed";
  result: DiscoveryResponse | null;
  error: string;
}

type Runner = (
  query: string,
  onProgress: (result: DiscoveryResponse) => void,
  options: DiscoveryStreamOptions,
) => Promise<DiscoveryResponse>;

export const DISCOVERY_WAIT_MS = 35_000;

/** Own one run at a time. Invalidating it precedes abort, including on unmount. */
export function createDiscoveryRun(
  onChange: (state: DiscoveryRunState) => void,
  options: { run?: Runner; maxWaitMs?: number } = {},
) {
  let state: DiscoveryRunState = {
    query: "",
    phase: "idle",
    result: null,
    error: "",
  };
  let sequence = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function invalidate() {
    sequence += 1;
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
  }

  function publish(patch: Partial<DiscoveryRunState>) {
    state = { ...state, ...patch };
    onChange(state);
  }

  function stop(phase: "cancelled" | "limit_reached" = "cancelled") {
    if (state.phase !== "running") return;
    invalidate();
    publish({ phase, error: "" });
  }

  return {
    getState: () => state,
    stop,
    dispose: invalidate,
    async start(query: string) {
      const input = query.trim();
      if (!input) return;
      invalidate();
      const request = sequence;
      controller = new AbortController();
      const signal = controller.signal;
      publish({ query: input, phase: "running", error: "" });
      timer = setTimeout(
        () => stop("limit_reached"),
        options.maxWaitMs ?? DISCOVERY_WAIT_MS,
      );
      try {
        const result = await (options.run ?? discoverSourcesProgress)(
          input,
          (snapshot) => {
            if (request === sequence && !signal.aborted) publish({ result: snapshot });
          },
          { signal },
        );
        if (request !== sequence || signal.aborted) return;
        publish({
          result,
          phase: result.stopReason ? "limit_reached" : "complete",
        });
      } catch (error) {
        if (request !== sequence || signal.aborted) return;
        publish({
          phase: "failed",
          error: error instanceof Error ? error.message : "外部查找失败，可主动重试。",
        });
      } finally {
        if (request === sequence) {
          clearTimeout(timer);
          controller = undefined;
        }
      }
    },
  };
}
