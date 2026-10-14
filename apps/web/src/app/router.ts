// Minimal hash router:
//   #/                       home (explore across types)
//   #/advisors               find advisors (old #/find still works)
//   #/advisor/:id            advisor detail
//   #/compare                compare advisors
//   #/opportunities[/:type]  opportunities, resources and rules (old #/resources works)
//   #/topics, #/topics/:id   my exploration topics
import { useSyncExternalStore } from "react";
import type { OpportunityType } from "../data/types";

export type Route =
  | { page: "home" }
  | { page: "find" }
  | { page: "advisor"; id: string }
  | { page: "compare" }
  | { page: "opportunities"; type?: OpportunityType }
  | { page: "topics" }
  | { page: "topic"; id: string };

const TYPES: OpportunityType[] = [
  "research",
  "graduate",
  "internship",
  "competition",
  "exchange",
  "activity",
  "support",
  "rules",
];

export function parseRoute(hash: string): Route {
  const [, first = "", second] = hash.replace(/^#/, "").split("/");
  const id = second ? decodeURIComponent(second) : undefined;
  switch (first) {
    case "advisors":
    case "find":
      return { page: "find" };
    case "advisor":
      return id ? { page: "advisor", id } : { page: "find" };
    case "compare":
      return { page: "compare" };
    case "opportunities":
      return {
        page: "opportunities",
        type: TYPES.includes(id as OpportunityType)
          ? (id as OpportunityType)
          : undefined,
      };
    case "resources":
      return { page: "opportunities", type: "support" };
    case "topics":
      return id ? { page: "topic", id } : { page: "topics" };
    default:
      return { page: "home" };
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case "home":
      return "#/";
    case "find":
      return "#/advisors";
    case "advisor":
      return `#/advisor/${encodeURIComponent(route.id)}`;
    case "opportunities":
      return route.type ? `#/opportunities/${route.type}` : "#/opportunities";
    case "topic":
      return `#/topics/${encodeURIComponent(route.id)}`;
    default:
      return `#/${route.page}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (listener) => {
      window.addEventListener("hashchange", listener);
      return () => window.removeEventListener("hashchange", listener);
    },
    () => window.location.hash,
  );
  return parseRoute(hash);
}
