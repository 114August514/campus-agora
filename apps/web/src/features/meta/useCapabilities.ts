import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api";
import { DEFAULT_CAPABILITIES, type ShellCapabilities } from "../auth/navigation";

/**
 * Reads the server's capability flags once. Until they arrive — and if the
 * request fails — the shell keeps the defaults, which are the *off* state.
 * Showing a control for a capability the server may not have is worse than
 * showing it a moment late, because the first thing the user does with it
 * fails.
 */
export function useCapabilities(): ShellCapabilities {
  const [capabilities, setCapabilities] =
    useState<ShellCapabilities>(DEFAULT_CAPABILITIES);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .getMeta()
      .then((meta) => {
        if (!cancelled) {
          setCapabilities({
            aiArchiveEnabled: meta.capabilities.aiArchiveEnabled,
          });
        }
      })
      .catch(() => {
        // Keep the defaults. A shell that hides a feature it cannot confirm is
        // the safe failure; one that shows it is not.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return capabilities;
}
