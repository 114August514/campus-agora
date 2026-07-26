import type { ReactNode } from "react";
import { ICON_DEFAULTS, Inbox } from "../icons";

/**
 * Every empty state gets a title, a description, and where possible the action
 * that fills it, so the user is never left at a dead end.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="stateBlock">
      <Inbox {...ICON_DEFAULTS} size={24} className="stateIcon" aria-hidden="true" />
      <p className="stateTitle">{title}</p>
      <p className="stateDescription">{description}</p>
      {action}
    </div>
  );
}
