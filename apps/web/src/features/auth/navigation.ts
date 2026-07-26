import type { CurrentUser } from "@campus-agora/api-client";
import { ROUTES } from "../../app/routes";

export interface NavigationItem {
  label: string;
  to: string;
  /** Roles allowed to see the entry; undefined means everyone, including guests. */
  allowedRoles?: ReadonlyArray<CurrentUser["systemRole"]>;
  /** Requires any authenticated session, regardless of role. */
  requiresAuth?: boolean;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "资料库", to: ROUTES.archiveList },
  { label: "讨论", to: ROUTES.discussionList },
  { label: "归档助手", to: ROUTES.home, requiresAuth: true },
  { label: "审核", to: ROUTES.home, allowedRoles: ["moderator", "admin"] },
];

/**
 * Filters shell navigation for the current viewer. This is a UX affordance
 * only: per docs/constraints/advanced-engineering-reference.md the backend
 * remains the security boundary, so hiding an entry never stands in for a
 * server-side permission check.
 */
export function visibleNavigationItems(
  user: CurrentUser | undefined,
): readonly NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => {
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
): readonly string[] {
  return visibleNavigationItems(user).map((item) => item.label);
}
