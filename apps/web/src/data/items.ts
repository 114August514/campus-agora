// Resolve a saved item reference (advisor or opportunity) to what lists display.
import { href } from "../app/router";
import { findAdvisor } from "./advisors";
import { findOpportunity, opportunityTypeText } from "./opportunities";
import type { ItemRef } from "./types";

export interface ItemView {
  title: string;
  meta: string;
  summary: string;
  /** In-app page, or the original site for opportunities. */
  link: { href: string; external: boolean };
}

export function describeItem(item: ItemRef): ItemView | undefined {
  if (item.kind === "advisor") {
    const a = findAdvisor(item.id);
    if (!a) return undefined;
    return {
      title: a.name,
      meta: `导师 · ${a.affiliation}`,
      summary: a.question,
      link: { href: href({ page: "advisor", id: a.id }), external: false },
    };
  }
  const o = findOpportunity(item.id);
  if (!o) return undefined;
  return {
    title: o.name,
    meta: `${o.types.map((t) => opportunityTypeText[t]).join("、")} · ${o.period}`,
    summary: o.summary,
    link: { href: o.entry.url, external: true },
  };
}
