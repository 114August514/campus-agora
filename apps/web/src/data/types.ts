// Public content shapes (task design v0.3 §3). Private topic records live in state/.

export interface SourceRef {
  label: string;
  url: string;
  /** When we last read/checked the page; not the page's own publish date. */
  checkedAt: string;
}

export type RouteKind = "undergrad_research" | "short_visit" | "graduate_application";

/** explicit = person states it; institutional = only a program entry; unconfirmed = path unverified. */
export type RouteStatus = "explicit" | "institutional" | "unconfirmed";

export interface ParticipationRoute {
  id: string;
  kind: RouteKind;
  title: string;
  status: RouteStatus;
  /** What the evidence actually says. */
  basis: string;
  /** Who it applies to / period, if known. */
  applicability?: string;
  /** What remains unknown for this route. */
  pending: string;
  entry?: SourceRef;
}

export interface ResearchWork {
  title: string;
  explanation: string;
  authorshipNote: string;
  links: SourceRef[];
}

export interface Advisor {
  id: string;
  name: string;
  affiliation: string;
  region: "内地" | "香港" | "美国";
  question: string;
  work: ResearchWork;
  routes: ParticipationRoute[];
  /** Used when no route evidence exists. */
  routeGap?: string;
  experience: { known: string; links: SourceRef[] };
  unknowns: string[];
  sourceNotes: string[];
  preparation: string;
  sources: SourceRef[];
}

/** Opportunity types across the product; one item may carry several. */
export type OpportunityType =
  | "research"
  | "graduate"
  | "internship"
  | "competition"
  | "exchange"
  | "activity"
  | "support"
  | "rules";

/**
 * historical = a dated batch that has ended (reference only, not open now);
 * standing = a service or rule without a batch deadline;
 * unknown = current state not confirmed.
 */
export type OpportunityTiming = "historical" | "standing" | "unknown";

export interface Opportunity {
  id: string;
  name: string;
  types: OpportunityType[];
  timing: OpportunityTiming;
  /** Which batch/year/time the information describes. */
  period: string;
  summary: string;
  /** Who it is for and key conditions, as stated by the source. */
  conditions: string;
  /** Support, cost or other practical notes, if the source states them. */
  support?: string;
  /** What must not be inferred from this source. */
  caveat: string;
  entry: SourceRef;
}

/** Anything a topic can hold. */
export type ItemRef = { kind: "advisor" | "opportunity"; id: string };
