import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Navigation that looks like a button. It renders a single `<a>`, not a
 * `<button>` inside a link: the nested form is invalid HTML and gives a
 * keyboard user two tab stops for one action, the inner one doing nothing.
 *
 * Use this whenever the control goes somewhere. `Button` is for controls that
 * do something on the current page.
 */
export function ButtonLink({
  children,
  to,
  variant = "secondary",
}: {
  children: ReactNode;
  to: string;
  variant?: ButtonVariant;
}) {
  return (
    <Link className={`button button-${variant}`} to={to}>
      {children}
    </Link>
  );
}
