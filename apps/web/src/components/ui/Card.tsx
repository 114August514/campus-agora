import type { ReactNode } from "react";

/**
 * A self-contained content unit or list item. Not a generic page-section
 * wrapper, and never nested inside another card.
 */
export function Card({
  children,
  as: Element = "div",
}: {
  children: ReactNode;
  as?: "div" | "article" | "li" | "section";
}) {
  return <Element className="card">{children}</Element>;
}
