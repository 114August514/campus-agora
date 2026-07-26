import type { CurrentUser } from "@campus-agora/api-client";

export interface NavigationItem {
  label: string;
  /** Roles allowed to see the entry; undefined means everyone, including guests. */
  allowedRoles?: ReadonlyArray<CurrentUser["systemRole"]>;
  /** Requires any authenticated session, regardless of role. */
  requiresAuth?: boolean;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "资料库" },
  { label: "讨论" },
  { label: "归档助手", requiresAuth: true },
  { label: "审核", allowedRoles: ["moderator", "admin"] },
];

/**
 * Filters shell navigation for the current viewer. This is a UX affordance
 * only: per docs/constraints/advanced-engineering-reference.md the backend
 * remains the security boundary, so hiding an entry never stands in for a
 * server-side permission check.
 */
export function visibleNavigationItems(
  user: CurrentUser | undefined,
): readonly string[] {
  return NAVIGATION_ITEMS.filter((item) => {
    if (item.allowedRoles) {
      return user !== undefined && item.allowedRoles.includes(user.systemRole);
    }

    if (item.requiresAuth) {
      return user !== undefined;
    }

    return true;
  }).map((item) => item.label);
}
