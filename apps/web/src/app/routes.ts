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
  designSystem: "/design-system",
} as const;

export const ROUTE_PATHS: readonly string[] = Object.values(ROUTES);

export function archiveDetailPath(id: string): string {
  return `/archive/${id}`;
}

export function archiveEditPath(id: string): string {
  return `/archive/${id}/edit`;
}
