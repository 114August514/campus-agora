import type { CurrentUser } from "@campus-agora/api-client";
import { ROUTES } from "../../app/routes";

/** The capability flags the shell reads from `/api/v1/meta`. */
export interface ShellCapabilities {
  aiArchiveEnabled: boolean;
}

export const DEFAULT_CAPABILITIES: ShellCapabilities = {
  // Matches the server default. Until meta answers, assume the safer state:
  // an entry that appears and then vanishes is worse than one that arrives.
  aiArchiveEnabled: false,
};

export interface NavigationItem {
  label: string;
  to: string;
  /** Roles allowed to see the entry; undefined means everyone, including guests. */
  allowedRoles?: ReadonlyArray<CurrentUser["systemRole"]>;
  /** Requires any authenticated session, regardless of role. */
  requiresAuth?: boolean;
  /**
   * A capability the server must have for the entry to mean anything. A
   * capability never grants access on its own — it only removes an entry whose
   * feature is switched off, so the role and auth checks still apply.
   */
  requiresCapability?: keyof ShellCapabilities;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "资料库", to: ROUTES.archiveList },
  { label: "讨论", to: ROUTES.discussionList },
  {
    label: "归档助手",
    to: ROUTES.discussionList,
    requiresAuth: true,
    requiresCapability: "aiArchiveEnabled",
  },
  {
    label: "审核",
    to: ROUTES.moderationQueue,
    allowedRoles: ["moderator", "admin"],
  },
];

/**
 * Filters shell navigation for the current viewer. This is a UX affordance
 * only: per docs/constraints/advanced-engineering-reference.md the backend
 * remains the security boundary, so hiding an entry never stands in for a
 * server-side permission check.
 */
export function visibleNavigationItems(
  user: CurrentUser | undefined,
  capabilities: ShellCapabilities = DEFAULT_CAPABILITIES,
): readonly NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => {
    if (item.requiresCapability && !capabilities[item.requiresCapability]) {
      return false;
    }

    if (item.allowedRoles) {
      return user !== undefined && item.allowedRoles.includes(user.systemRole);
    }

    if (item.requiresAuth) {
      return user !== undefined;
    }

    return true;
  });
}

export function visibleNavigationLabels(
  user: CurrentUser | undefined,
  capabilities: ShellCapabilities = DEFAULT_CAPABILITIES,
): readonly string[] {
  return visibleNavigationItems(user, capabilities).map((item) => item.label);
}
