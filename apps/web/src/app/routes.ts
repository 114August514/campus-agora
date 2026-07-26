/**
 * The route table, kept as data so it can be asserted in tests and reused by
 * navigation without duplicating path strings.
 */
export const ROUTES = {
  home: "/",
  archiveList: "/archive",
  archiveNew: "/archive/new",
  archiveDetail: "/archive/:id",
  archiveEdit: "/archive/:id/edit",
  // Discussions get their own namespace rather than a mode of the archive
  // pages. The two kinds of content answer different questions and show
  // different things, and keeping the URLs apart is the structural half of
  // that distinction.
  discussionList: "/discussions",
  discussionNew: "/discussions/new",
  discussionDetail: "/discussions/:id",
  designSystem: "/design-system",
} as const;

export const ROUTE_PATHS: readonly string[] = Object.values(ROUTES);

export function archiveDetailPath(id: string): string {
  return `/archive/${id}`;
}

export function archiveEditPath(id: string): string {
  return `/archive/${id}/edit`;
}

export function discussionDetailPath(id: string): string {
  return `/discussions/${id}`;
}
