import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ICON_DEFAULTS, Loader2 } from "../icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  /**
   * Disables the button and shows a spinner. Disabling is the point: without
   * it a slow request can be submitted twice by an impatient double click.
   */
  loading?: boolean;
}

export function Button({
  children,
  variant = "secondary",
  loading = false,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button-${variant}`}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Loader2
          {...ICON_DEFAULTS}
          size={16}
          className="buttonSpinner"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
