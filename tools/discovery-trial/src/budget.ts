import type { RunLimits, RunUsage } from "./types.ts";

export type StopReason = "cancelled" | "limit-reached";

/** Thrown when the run must stop launching work; partial results are kept by the caller. */
export class RunStopped extends Error {
  readonly reason: StopReason;

  constructor(reason: StopReason, detail: string) {
    super(detail);
    this.name = "RunStopped";
    this.reason = reason;
  }
}

/**
 * Enforces declared per-run limits and user cancellation. Every external call must
 * `take()` first; results arriving after a stop are discarded by checking `stopped`.
 */
export class RunBudget {
  readonly limits: RunLimits;
  private readonly external: AbortSignal;
  private readonly deadline: number;
  private readonly used: RunUsage = { search: 0, read: 0, llm: 0 };
  private stopReason: RunStopped | undefined;

  constructor(limits: RunLimits, external: AbortSignal, now: number = Date.now()) {
    this.limits = limits;
    this.external = external;
    this.deadline = now + limits.runTimeoutMs;
  }

  get usage(): RunUsage {
    return { ...this.used };
  }

  get stopped(): RunStopped | undefined {
    if (!this.stopReason) {
      if (this.external.aborted) {
        this.stopReason = new RunStopped("cancelled", "用户中止了本次查找");
      } else if (Date.now() >= this.deadline) {
        this.stopReason = new RunStopped("limit-reached", "单次运行时间已达上限");
      }
    }
    return this.stopReason;
  }

  ensureActive(): void {
    const stop = this.stopped;
    if (stop) throw stop;
  }

  take(kind: keyof RunUsage): void {
    this.ensureActive();
    const max = {
      search: this.limits.maxSearchCalls,
      read: this.limits.maxReads,
      llm: this.limits.maxLlmCalls,
    }[kind];
    if (this.used[kind] >= max) {
      this.stopReason = new RunStopped("limit-reached", `${kind} 调用已达上限 ${max}`);
      throw this.stopReason;
    }
    this.used[kind] += 1;
  }

  /** Signal for one request: aborts on cancel, run deadline, or per-request timeout. */
  requestSignal(): AbortSignal {
    const remaining = Math.max(1, this.deadline - Date.now());
    return AbortSignal.any([
      this.external,
      AbortSignal.timeout(Math.min(this.limits.requestTimeoutMs, remaining)),
    ]);
  }
}
